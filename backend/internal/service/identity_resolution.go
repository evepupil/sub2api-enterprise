package service

// 本文件实现面向 ACF 安全网关的身份解析：拿一把原始调用密钥，换出组织、
// 用户、密钥三级归属。接口契约见 ACF 侧 docs/接口契约/sub2api-身份解析.md，
// 双方语义对齐记录见本仓库 docs/模块设计/ACF身份解析接口.md。
//
// 语义要点（与 ACF 的约定）：
//   - 这里只回答「谁发的」，不判断密钥还能不能用——有效性由正常鉴权链路
//     决定。因此停用的密钥、停用的账号照样返回归属。
//   - 个人用户（不属于任何组织）组织一层为空，空即个人用户。
//   - 编号是平台内唯一 ID，永不改变；名字取解析当时的值，之后改名不跟进，
//     ACF 侧按「一次绑定永不变」落库存名。

import (
	"context"
	"errors"
	"strings"
)

// ErrIdentityKeyNotFound 表示密钥不存在或已删除，对应契约的 404 key_not_found。
// 契约约定「格式不对」也归这一类：格式不对的密钥不可能存在。
var ErrIdentityKeyNotFound = errors.New("identity resolution: api key not found")

// IdentityKeyLookup 身份解析按原始密钥取密钥与属主的窄接口，
// 实现为密钥仓储；密钥属主（User）必须随查询一并带出。
type IdentityKeyLookup interface {
	GetByKey(ctx context.Context, key string) (*APIKey, error)
}

// IdentityOrganizationLookup 按用户查组织归属的窄接口，实现为组织服务；
// 用户不属于任何组织时返回 (nil, nil)。
type IdentityOrganizationLookup interface {
	GetSummaryByUserID(ctx context.Context, userID int64) (*OrganizationSummary, error)
}

// IdentityOrganization 归属中的组织一层；个人用户没有这一层。
type IdentityOrganization struct {
	ID   int64
	Name string
}

// IdentityUser 归属中的用户一层。
type IdentityUser struct {
	ID   int64
	Name string
}

// IdentityKey 归属中的密钥一层。
type IdentityKey struct {
	ID   int64
	Name string
}

// IdentityAttribution 一把密钥的完整归属。
type IdentityAttribution struct {
	// Organization 为 nil 表示密钥属主是个人用户，没有组织。
	Organization *IdentityOrganization
	User         IdentityUser
	Key          IdentityKey
}

// IdentityResolutionService 身份解析用例：ACF 网关用它把密钥换成人。
type IdentityResolutionService struct {
	keys IdentityKeyLookup
	orgs IdentityOrganizationLookup
}

func NewIdentityResolutionService(keys IdentityKeyLookup, orgs IdentityOrganizationLookup) *IdentityResolutionService {
	return &IdentityResolutionService{keys: keys, orgs: orgs}
}

// ProvideIdentityKeyLookup 把密钥仓储收窄成身份解析需要的查找接口。
func ProvideIdentityKeyLookup(repo APIKeyRepository) IdentityKeyLookup { return repo }

// ProvideIdentityOrganizationLookup 把组织服务收窄成身份解析需要的归属查询接口。
func ProvideIdentityOrganizationLookup(s *OrganizationService) IdentityOrganizationLookup { return s }

// Resolve 查一把密钥的归属。密钥不存在或已删除时返回 ErrIdentityKeyNotFound。
func (s *IdentityResolutionService) Resolve(ctx context.Context, apiKey string) (*IdentityAttribution, error) {
	if s == nil || s.keys == nil || s.orgs == nil {
		return nil, errors.New("identity resolution: service not initialized")
	}

	key, err := s.keys.GetByKey(ctx, apiKey)
	if err != nil {
		if errors.Is(err, ErrAPIKeyNotFound) {
			return nil, ErrIdentityKeyNotFound
		}
		return nil, err
	}

	attribution := &IdentityAttribution{
		User: IdentityUser{ID: key.UserID, Name: accountDisplayName(key.User)},
		Key:  IdentityKey{ID: key.ID, Name: key.Name},
	}

	summary, err := s.orgs.GetSummaryByUserID(ctx, key.UserID)
	if err != nil {
		return nil, err
	}
	if summary != nil {
		attribution.Organization = &IdentityOrganization{ID: summary.ID, Name: summary.Name}
		// 组织成员的名字优先用成员备注名，回退到账号本身的名字。
		if name := strings.TrimSpace(summary.DisplayName); name != "" {
			attribution.User.Name = name
		}
	}
	return attribution, nil
}

// accountDisplayName 账号的名字：用户名优先，回退邮箱。
func accountDisplayName(user *User) string {
	if user == nil {
		return ""
	}
	if name := strings.TrimSpace(user.Username); name != "" {
		return name
	}
	return strings.TrimSpace(user.Email)
}
