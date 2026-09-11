package routes

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/handler"

	"github.com/gin-gonic/gin"
)

// 成员管理里既有按成员标识的路径，也有固定的均分路径，注册顺序或路径写法出错时
// gin 会在启动时直接 panic。这里在测试里提前把路由表建出来。
func TestOrganizationRoutesRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handlers := &handler.Handlers{
		Organization:       &handler.OrganizationHandler{},
		OrganizationMember: &handler.OrganizationMemberHandler{},
	}

	registerOrganizationRoutes(router.Group("/api/v1"), handlers)

	registered := map[string]bool{}
	for _, route := range router.Routes() {
		registered[fmt.Sprintf("%s %s", route.Method, route.Path)] = true
	}

	expected := []string{
		http.MethodGet + " /api/v1/organization",
		http.MethodGet + " /api/v1/organization/invitations",
		http.MethodPost + " /api/v1/organization/invitations",
		http.MethodGet + " /api/v1/organization/members",
		http.MethodPut + " /api/v1/organization/members/:user_id/status",
		http.MethodPut + " /api/v1/organization/members/:user_id/spending-limit",
		http.MethodPost + " /api/v1/organization/members/spending-limit-split",
	}
	for _, route := range expected {
		if !registered[route] {
			t.Fatalf("route %q is not registered", route)
		}
	}
}
