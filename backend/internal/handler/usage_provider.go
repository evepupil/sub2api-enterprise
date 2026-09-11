package handler

import "github.com/Wei-Shaw/sub2api/internal/service"

// ProvideUsageHandler 组装用量接口，并接上组织成员服务，让组织创建者能查全组织用量。
func ProvideUsageHandler(
	usageService *service.UsageService,
	apiKeyService *service.APIKeyService,
	opsService *service.OpsService,
	settingService *service.SettingService,
	organizationMemberService *service.OrganizationMemberService,
) *UsageHandler {
	handler := NewUsageHandler(usageService, apiKeyService, opsService, settingService)
	handler.SetOrganizationMemberService(organizationMemberService)
	return handler
}
