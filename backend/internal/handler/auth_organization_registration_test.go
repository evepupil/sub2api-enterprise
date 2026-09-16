package handler

import (
	"net/http/httptest"
	"testing"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOAuthOrganizationRegistrationContextSurvivesProviderRedirect(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		"GET",
		"/api/v1/auth/oauth/github/start?organization_name=Example%20Team&member_name=%E5%BC%A0%E4%B8%89&invitation_code=ORG-CODE",
		nil,
	)

	captureOAuthOrganizationRegistration(ctx, false)
	cookies := recorder.Result().Cookies()
	require.Len(t, cookies, 3)

	callbackRecorder := httptest.NewRecorder()
	callbackCtx, _ := gin.CreateTestContext(callbackRecorder)
	callbackCtx.Request = httptest.NewRequest("GET", "/api/v1/auth/oauth/github/callback", nil)
	for _, cookie := range cookies {
		callbackCtx.Request.AddCookie(cookie)
	}

	require.Equal(t, "Example Team", readOAuthRegistrationCookie(callbackCtx, oauthOrganizationNameCookie))
	require.Equal(t, "张三", readOAuthRegistrationCookie(callbackCtx, oauthMemberNameCookie))
	require.Equal(t, "ORG-CODE", readOAuthRegistrationCookie(callbackCtx, oauthInvitationCodeCookie))
}

func TestPendingOAuthRegistrationValuesPreferRequestThenSession(t *testing.T) {
	session := &dbent.PendingAuthSession{LocalFlowState: map[string]any{
		oauthOrganizationNameKey: "Stored Team",
		oauthMemberNameKey:       "Stored Name",
		oauthInvitationCodeKey:   "STORED-CODE",
	}}

	organizationName, memberName, invitationCode := pendingOAuthRegistrationValues(session, "", "", "")
	require.Equal(t, "Stored Team", organizationName)
	require.Equal(t, "Stored Name", memberName)
	require.Equal(t, "STORED-CODE", invitationCode)

	organizationName, memberName, invitationCode = pendingOAuthRegistrationValues(session, "Request Team", "Request Name", "REQUEST-CODE")
	require.Equal(t, "Request Team", organizationName)
	require.Equal(t, "Request Name", memberName)
	require.Equal(t, "REQUEST-CODE", invitationCode)
}
