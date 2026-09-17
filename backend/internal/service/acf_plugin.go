package service

// ACF 组织防护只读插件页（M3 模块 3）：本服务负责两件事——
//
//  1. 签发用户断言：代理每次数据调用前，当场重验调用者的组织身份，
//     签出短时 EdDSA 断言（claims 砍到最小：iss/aud/sub/org/iat/exp）。
//     断言的 sub/org 与身份解析返回的编号完全同源（都是主键的字符串
//     形态）——这是双方约定的铁律，「谁在查数据」和「谁触发了安全
//     事件」必须对得上同一个人。
//  2. 代理数据查询：把插件页的五组查询转发给 ACF 侧的只读接口，
//     断言放在 Authorization 头，组织范围由断言锁定，查询参数只允许
//     时间窗口。
//
// 认证模型与契约细节见 docs/模块设计/ACF身份解析接口.md §6 与 ACF 侧
// docs/模块设计/只读查询接口.md §2。断言密钥为独立非对称密钥（Ed25519），
// 与控制台 jwt.secret、身份解析共享凭证互不复用——两个信任用途、两套凭证。

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

// 断言签发常量。Issuer/Audience 的默认值与 ACF 侧验签配置一致，
// 可通过 acf.plugin.issuer / acf.plugin.audience 覆盖。
const (
	ACFPluginIssuerDefault   = "sub2api"
	ACFPluginAudienceDefault = "acf-plugin"

	// ACFPluginAssertionTTL 断言有效期。签发前已当场重验组织身份，
	// 短时效只为压缩断言泄露后的可用窗口。
	ACFPluginAssertionTTL = 5 * time.Minute

	// acfPluginKeyFileName 私钥文件名（数据目录下），PKCS8 PEM，0600。
	acfPluginKeyFileName = "acf_plugin_ed25519_key.pem"

	// acfPluginQueryTimeout 单次数据查询的超时；插件页是人手刷新的
	// 面板查询，超时快速失败比挂着强。
	acfPluginQueryTimeout = 10 * time.Second

	// acfPluginMaxResponseBytes 数据响应的大小上限，防异常响应吃内存。
	acfPluginMaxResponseBytes = 4 << 20
)

// 断言签发与代理查询的业务错误。
var (
	// ErrACFPluginForbidden 当前用户无权查看组织防护数据（非组织管理员）。
	ErrACFPluginForbidden = errors.New("acf plugin: user is not an organization owner")
	// ErrACFPluginOrgRequired 平台管理员未指定要查看的组织。
	ErrACFPluginOrgRequired = errors.New("acf plugin: org id is required for platform admin")
	// ErrACFPluginUnknownEndpoint 请求了未知的插件数据端点。
	ErrACFPluginUnknownEndpoint = errors.New("acf plugin: unknown data endpoint")
	// ErrACFPluginDisabled 插件功能未配置（base_url 为空）。
	ErrACFPluginDisabled = errors.New("acf plugin: feature is disabled")
	// ErrACFPluginWindowInvalid 时间窗口非法（起止倒置或跨度超 90 天）。
	ErrACFPluginWindowInvalid = errors.New("acf plugin: invalid time window")
)

// ACFPluginDataEndpoint 插件数据端点名，取值与 ACF 侧路由一一对应。
type ACFPluginDataEndpoint string

const (
	ACFPluginEndpointSummary      ACFPluginDataEndpoint = "summary"
	ACFPluginEndpointTrend        ACFPluginDataEndpoint = "trend"
	ACFPluginEndpointRiskTypes    ACFPluginDataEndpoint = "risk-types"
	ACFPluginEndpointTopActors    ACFPluginDataEndpoint = "top-actors"
	ACFPluginEndpointRecentEvents ACFPluginDataEndpoint = "recent-events"
)

// ACFPluginKeyPair 是断言签名的 Ed25519 密钥对。
type ACFPluginKeyPair struct {
	Private ed25519.PrivateKey
	Public  ed25519.PublicKey
	// KeyID 写入 JWT 头 kid，取公钥哈希前缀；将来轮换时可区分新旧密钥。
	KeyID string
}

// LoadOrCreateACFPluginKeyPair 从 keyFile 读取 Ed25519 私钥（PKCS8 PEM），
// 文件不存在时生成新密钥对并落盘（0600）。已存在的文件解析失败直接报错：
// 密钥材料坏了宁可起不来，也不能静默换钥导致 ACF 侧验签全挂。
func LoadOrCreateACFPluginKeyPair(keyFile string) (*ACFPluginKeyPair, error) {
	if strings.TrimSpace(keyFile) == "" {
		return nil, errors.New("acf plugin: key file path is empty")
	}
	//nolint:gosec // G703: keyFile 来自部署配置(DATA_DIR/config)，并非用户输入
	if data, err := os.ReadFile(keyFile); err == nil {
		private, parseErr := parseACFPluginPrivateKey(data)
		if parseErr != nil {
			return nil, fmt.Errorf("acf plugin: 解析私钥文件 %s: %w", keyFile, parseErr)
		}
		return newACFPluginKeyPair(private)
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("acf plugin: 读取私钥文件 %s: %w", keyFile, err)
	}

	_, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("acf plugin: 生成密钥对: %w", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(private)
	if err != nil {
		return nil, fmt.Errorf("acf plugin: 序列化私钥: %w", err)
	}
	//nolint:gosec // G703: 同上，路径来自部署配置
	if err := os.MkdirAll(filepath.Dir(keyFile), 0o755); err != nil {
		return nil, fmt.Errorf("acf plugin: 创建密钥目录: %w", err)
	}
	//nolint:gosec // G703: 同上，路径来自部署配置
	if err := os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}), 0o600); err != nil {
		return nil, fmt.Errorf("acf plugin: 写入私钥文件: %w", err)
	}
	return newACFPluginKeyPair(private)
}

// ACFPluginKeyPairFromPrivate 用外部提供的私钥（PKCS8 PEM）构造密钥对。
func ACFPluginKeyPairFromPrivate(privateKeyPEM string) (*ACFPluginKeyPair, error) {
	private, err := parseACFPluginPrivateKey([]byte(privateKeyPEM))
	if err != nil {
		return nil, err
	}
	return newACFPluginKeyPair(private)
}

// PublicKeyPEM 导出 PKIX PEM 公钥，交给部署者贴进 ACF 侧的端点配置。
func (k *ACFPluginKeyPair) PublicKeyPEM() (string, error) {
	der, err := x509.MarshalPKIXPublicKey(k.Public)
	if err != nil {
		return "", fmt.Errorf("acf plugin: 序列化公钥: %w", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})), nil
}

func parseACFPluginPrivateKey(data []byte) (ed25519.PrivateKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("不是合法的 PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("解析 PKCS8 私钥: %w", err)
	}
	private, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("密钥类型不支持: %T（当前只支持 Ed25519）", parsed)
	}
	return private, nil
}

func newACFPluginKeyPair(private ed25519.PrivateKey) (*ACFPluginKeyPair, error) {
	public, ok := private.Public().(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("acf plugin: 公钥类型异常")
	}
	sum := sha256.Sum256(public)
	return &ACFPluginKeyPair{
		Private: private,
		Public:  public,
		KeyID:   hex.EncodeToString(sum[:4]),
	}, nil
}

// ACFPluginService 组织防护插件页的断言签发与数据代理。
type ACFPluginService struct {
	key      *ACFPluginKeyPair
	issuer   string
	audience string
	baseURL  string
	client   *http.Client
	now      func() time.Time

	// summaries 组织管理员路径：按用户查组织归属（非成员返回 nil,nil）。
	summaries IdentityOrganizationLookup
	// orgs 平台管理员路径：按 ID 校验组织存在。
	orgs OrganizationRepository
}

// ProvideACFPluginService 装配插件服务；BaseURL 为空表示功能关闭，
// 返回 nil 服务（处理器据此对请求返回功能未开启）。
func ProvideACFPluginService(cfg *config.Config, summaries IdentityOrganizationLookup, orgs OrganizationRepository) (*ACFPluginService, error) {
	if cfg == nil || strings.TrimSpace(cfg.ACF.Plugin.BaseURL) == "" {
		return nil, nil
	}
	keyFile := strings.TrimSpace(cfg.ACF.Plugin.KeyFile)
	if keyFile == "" {
		dataDir := os.Getenv("DATA_DIR")
		if strings.TrimSpace(dataDir) == "" {
			dataDir = "data"
		}
		keyFile = filepath.Join(dataDir, acfPluginKeyFileName)
	}
	var key *ACFPluginKeyPair
	var err error
	if strings.TrimSpace(cfg.ACF.Plugin.PrivateKey) != "" {
		key, err = ACFPluginKeyPairFromPrivate(cfg.ACF.Plugin.PrivateKey)
	} else {
		key, err = LoadOrCreateACFPluginKeyPair(keyFile)
	}
	if err != nil {
		return nil, err
	}
	issuer := cfg.ACF.Plugin.Issuer
	if issuer == "" {
		issuer = ACFPluginIssuerDefault
	}
	audience := cfg.ACF.Plugin.Audience
	if audience == "" {
		audience = ACFPluginAudienceDefault
	}
	return &ACFPluginService{
		key:       key,
		issuer:    issuer,
		audience:  audience,
		baseURL:   strings.TrimRight(cfg.ACF.Plugin.BaseURL, "/"),
		client:    &http.Client{},
		now:       time.Now,
		summaries: summaries,
		orgs:      orgs,
	}, nil
}

// PublicKeyPEM 导出公钥 PEM，供部署者贴进 ACF 侧端点配置。
func (s *ACFPluginService) PublicKeyPEM() (string, error) {
	return s.key.PublicKeyPEM()
}

// SignAssertion 为「某用户在某组织」签出短时断言。调用方必须先完成
// 组织身份校验；本方法只负责把校验结论变成 ACF 可验证的凭证。
// 编号转字符串的规则与身份解析一致（strconv 主键十进制），铁律所在。
func (s *ACFPluginService) SignAssertion(userID, orgID int64) (string, error) {
	if s == nil || s.key == nil {
		return "", ErrACFPluginDisabled
	}
	now := s.now()
	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, jwt.MapClaims{
		"iss": s.issuer,
		"aud": s.audience,
		"sub": strconv.FormatInt(userID, 10),
		"org": strconv.FormatInt(orgID, 10),
		"iat": now.Unix(),
		"exp": now.Add(ACFPluginAssertionTTL).Unix(),
	})
	token.Header["kid"] = s.key.KeyID
	return token.SignedString(s.key.Private)
}

// AuthorizePluginView 校验调用者能否查看组织防护数据，返回要查看的组织 ID。
//   - 平台管理员：必须显式指定 org_id，可查看任意存在的组织；
//   - 组织管理员：组织范围来自本人归属，禁止指定其他组织；
//   - 其他用户：一律拒绝。
func (s *ACFPluginService) AuthorizePluginView(ctx context.Context, userID int64, role string, orgIDParam *int64) (int64, error) {
	if s == nil {
		return 0, ErrACFPluginDisabled
	}
	if role == RoleAdmin {
		if orgIDParam == nil {
			return 0, ErrACFPluginOrgRequired
		}
		if _, err := s.orgs.GetByID(ctx, *orgIDParam); err != nil {
			return 0, err
		}
		return *orgIDParam, nil
	}
	summary, err := s.summaries.GetSummaryByUserID(ctx, userID)
	if err != nil {
		return 0, err
	}
	if summary == nil || !summary.IsOwner {
		return 0, ErrACFPluginForbidden
	}
	if orgIDParam != nil && *orgIDParam != summary.ID {
		return 0, ErrACFPluginForbidden
	}
	return summary.ID, nil
}

// QueryPluginData 代理一次插件数据查询：签断言、调 ACF、原样返回
// 状态码与响应体（响应是给插件页消费的 JSON，本服务不做二次解释）。
func (s *ACFPluginService) QueryPluginData(ctx context.Context, userID, orgID int64, endpoint ACFPluginDataEndpoint, from, to time.Time) (int, []byte, error) {
	if s == nil {
		return 0, nil, ErrACFPluginDisabled
	}
	switch endpoint {
	case ACFPluginEndpointSummary, ACFPluginEndpointTrend, ACFPluginEndpointRiskTypes,
		ACFPluginEndpointTopActors, ACFPluginEndpointRecentEvents:
	default:
		return 0, nil, ErrACFPluginUnknownEndpoint
	}
	assertion, err := s.SignAssertion(userID, orgID)
	if err != nil {
		return 0, nil, err
	}

	query := url.Values{}
	query.Set("from", from.Format(time.RFC3339))
	query.Set("to", to.Format(time.RFC3339))
	target := s.baseURL + "/api/v1/plugin/" + string(endpoint) + "?" + query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return 0, nil, fmt.Errorf("acf plugin: 构造查询请求: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+assertion)

	callCtx, cancel := context.WithTimeout(ctx, acfPluginQueryTimeout)
	defer cancel()
	resp, err := s.client.Do(req.WithContext(callCtx))
	if err != nil {
		return 0, nil, fmt.Errorf("acf plugin: 查询失败: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, acfPluginMaxResponseBytes))
	if err != nil {
		return 0, nil, fmt.Errorf("acf plugin: 读取响应: %w", err)
	}
	return resp.StatusCode, body, nil
}
