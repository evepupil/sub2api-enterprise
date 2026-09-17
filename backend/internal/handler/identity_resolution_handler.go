package handler

// ACF 安全网关的身份解析接口。
//
// 契约：POST /api/internal/identity/resolve，请求体 {"api_key": "..."}，
// 服务凭证以 Bearer 方式放在请求头（由凭证中间件校验）。200 返回组织、
// 用户、密钥三级归属，编号一律是字符串；个人用户组织为 null；查无此密钥
// 返回 404 {"error":{"code":"key_not_found"}}，密钥「格式不对」按契约也归
// 404——格式不对的密钥不可能存在。这里不判断密钥能否使用。

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// identityAPIKeyMaxLen 与密钥表的字段上限一致；更长的输入视为格式不对。
const identityAPIKeyMaxLen = 128

type IdentityResolutionHandler struct {
	service *service.IdentityResolutionService
}

func NewIdentityResolutionHandler(identityService *service.IdentityResolutionService) *IdentityResolutionHandler {
	return &IdentityResolutionHandler{service: identityService}
}

type identityResolveRequest struct {
	APIKey string `json:"api_key"`
}

// identityAttributionNode 是归属里的一层；编号以字符串返回，
// ACF 侧把它当不透明标识永久保存。
type identityAttributionNode struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type identityAttributionResponse struct {
	// Organization 为 null 表示个人用户，没有组织（契约的「空即个人」约定）。
	Organization *identityAttributionNode `json:"organization"`
	User         identityAttributionNode  `json:"user"`
	Key          identityAttributionNode  `json:"key"`
}

// Resolve 处理 ACF 的身份解析请求。密钥本身绝不进日志、不进任何响应。
func (h *IdentityResolutionHandler) Resolve(c *gin.Context) {
	var req identityResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.APIKey) == "" {
		respondIdentityResolutionError(c, http.StatusBadRequest, "invalid_request")
		return
	}
	// 密钥字段超长属于「格式不对」，契约约定与查无此密钥同语义。
	if len(req.APIKey) > identityAPIKeyMaxLen {
		respondIdentityResolutionError(c, http.StatusNotFound, "key_not_found")
		return
	}

	attribution, err := h.service.Resolve(c.Request.Context(), req.APIKey)
	if err != nil {
		if errors.Is(err, service.ErrIdentityKeyNotFound) {
			logger.LegacyPrintf("identity_resolution", "resolve outcome=key_not_found")
			respondIdentityResolutionError(c, http.StatusNotFound, "key_not_found")
			return
		}
		logger.LegacyPrintf("identity_resolution", "resolve outcome=error err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "internal_error"}})
		return
	}

	resp := identityAttributionResponse{
		User: identityAttributionNode{
			ID:   strconv.FormatInt(attribution.User.ID, 10),
			Name: attribution.User.Name,
		},
		Key: identityAttributionNode{
			ID:   strconv.FormatInt(attribution.Key.ID, 10),
			Name: attribution.Key.Name,
		},
	}
	if attribution.Organization != nil {
		resp.Organization = &identityAttributionNode{
			ID:   strconv.FormatInt(attribution.Organization.ID, 10),
			Name: attribution.Organization.Name,
		}
	}

	if attribution.Organization != nil {
		logger.LegacyPrintf("identity_resolution", "resolve outcome=found org=%d user=%d", attribution.Organization.ID, attribution.User.ID)
	} else {
		logger.LegacyPrintf("identity_resolution", "resolve outcome=personal user=%d", attribution.User.ID)
	}
	c.JSON(http.StatusOK, resp)
}

func respondIdentityResolutionError(c *gin.Context, status int, code string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code}})
}
