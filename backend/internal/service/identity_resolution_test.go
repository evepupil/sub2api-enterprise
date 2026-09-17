package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type fakeIdentityKeyLookup struct {
	keys  map[string]*APIKey
	calls int
}

func (f *fakeIdentityKeyLookup) GetByKey(ctx context.Context, key string) (*APIKey, error) {
	f.calls++
	if k, ok := f.keys[key]; ok {
		return k, nil
	}
	return nil, ErrAPIKeyNotFound
}

type fakeIdentityOrgLookup struct {
	summaries map[int64]*OrganizationSummary
}

func (f *fakeIdentityOrgLookup) GetSummaryByUserID(ctx context.Context, userID int64) (*OrganizationSummary, error) {
	return f.summaries[userID], nil
}

func newIdentityResolutionFixture(keys map[string]*APIKey, summaries map[int64]*OrganizationSummary) (*IdentityResolutionService, *fakeIdentityKeyLookup) {
	keyLookup := &fakeIdentityKeyLookup{keys: keys}
	return NewIdentityResolutionService(keyLookup, &fakeIdentityOrgLookup{summaries: summaries}), keyLookup
}

func memberKey(userID int64) *APIKey {
	return &APIKey{
		ID:     7,
		UserID: userID,
		Key:    "sk-member",
		Name:   "CI 专用",
		User:   &User{ID: userID, Username: "zhangsan", Email: "zhangsan@example.com"},
	}
}

func TestIdentityResolutionMemberPrefersDisplayName(t *testing.T) {
	keys := map[string]*APIKey{"sk-member": memberKey(13)}
	summaries := map[int64]*OrganizationSummary{
		13: {ID: 12, Name: "某某科技", DisplayName: "张三备注"},
	}
	svc, _ := newIdentityResolutionFixture(keys, summaries)

	attribution, err := svc.Resolve(context.Background(), "sk-member")
	require.NoError(t, err)
	require.NotNil(t, attribution.Organization)
	require.Equal(t, int64(12), attribution.Organization.ID)
	require.Equal(t, "某某科技", attribution.Organization.Name)
	require.Equal(t, int64(13), attribution.User.ID)
	require.Equal(t, "张三备注", attribution.User.Name)
	require.Equal(t, int64(7), attribution.Key.ID)
	require.Equal(t, "CI 专用", attribution.Key.Name)
}

func TestIdentityResolutionMemberNameFallsBackToAccountName(t *testing.T) {
	keys := map[string]*APIKey{"sk-member": memberKey(13)}
	summaries := map[int64]*OrganizationSummary{
		13: {ID: 12, Name: "某某科技", DisplayName: "  "},
	}
	svc, _ := newIdentityResolutionFixture(keys, summaries)

	attribution, err := svc.Resolve(context.Background(), "sk-member")
	require.NoError(t, err)
	require.Equal(t, "zhangsan", attribution.User.Name)
}

func TestIdentityResolutionPersonalUserHasNoOrganization(t *testing.T) {
	keys := map[string]*APIKey{"sk-personal": memberKey(13)}
	svc, _ := newIdentityResolutionFixture(keys, nil)

	attribution, err := svc.Resolve(context.Background(), "sk-personal")
	require.NoError(t, err)
	require.Nil(t, attribution.Organization)
	// 个人用户没有成员备注名，回退到用户名。
	require.Equal(t, "zhangsan", attribution.User.Name)
}

func TestIdentityResolutionUsernameMissingFallsBackToEmail(t *testing.T) {
	key := memberKey(13)
	key.User.Username = ""
	keys := map[string]*APIKey{"sk-personal": key}
	svc, _ := newIdentityResolutionFixture(keys, nil)

	attribution, err := svc.Resolve(context.Background(), "sk-personal")
	require.NoError(t, err)
	require.Equal(t, "zhangsan@example.com", attribution.User.Name)
}

func TestIdentityResolutionKeyNotFound(t *testing.T) {
	svc, keyLookup := newIdentityResolutionFixture(nil, nil)

	_, err := svc.Resolve(context.Background(), "sk-missing")
	require.ErrorIs(t, err, ErrIdentityKeyNotFound)
	require.Equal(t, 1, keyLookup.calls)
}

func TestIdentityResolutionDisabledKeyStillAttributed(t *testing.T) {
	// 归属和有效性是两件事：停用的密钥照样答「谁发的」，
	// 能不能用由正常鉴权链路决定。
	key := memberKey(13)
	key.Status = StatusDisabled
	keys := map[string]*APIKey{"sk-disabled": key}
	summaries := map[int64]*OrganizationSummary{
		13: {ID: 12, Name: "某某科技", DisplayName: "张三备注"},
	}
	svc, _ := newIdentityResolutionFixture(keys, summaries)

	attribution, err := svc.Resolve(context.Background(), "sk-disabled")
	require.NoError(t, err)
	require.NotNil(t, attribution.Organization)
}

func TestIdentityResolutionSameUserMultipleKeysSameIdentity(t *testing.T) {
	secondKey := memberKey(13)
	secondKey.ID = 8
	secondKey.Key = "sk-second"
	keys := map[string]*APIKey{"sk-member": memberKey(13), "sk-second": secondKey}
	summaries := map[int64]*OrganizationSummary{
		13: {ID: 12, Name: "某某科技", DisplayName: "张三备注"},
	}
	svc, _ := newIdentityResolutionFixture(keys, summaries)

	first, err := svc.Resolve(context.Background(), "sk-member")
	require.NoError(t, err)
	second, err := svc.Resolve(context.Background(), "sk-second")
	require.NoError(t, err)

	// 契约要求：同一人多把密钥，用户编号必须相同，密钥编号必须不同。
	require.Equal(t, first.User.ID, second.User.ID)
	require.Equal(t, first.User.Name, second.User.Name)
	require.NotEqual(t, first.Key.ID, second.Key.ID)
}

func TestIdentityResolutionUnexpectedLookupErrorNotMappedToNotFound(t *testing.T) {
	// 数据库故障不能伪装成「查无此密钥」：404 会诱导 ACF 侧当成确定结论，
	// 而内部错误应当以 500 语义暴露。
	svc := NewIdentityResolutionService(
		brokenIdentityKeyLookup{},
		&fakeIdentityOrgLookup{},
	)
	_, err := svc.Resolve(context.Background(), "sk-anything")
	require.Error(t, err)
	require.False(t, errors.Is(err, ErrIdentityKeyNotFound))
}

type brokenIdentityKeyLookup struct{}

func (brokenIdentityKeyLookup) GetByKey(ctx context.Context, key string) (*APIKey, error) {
	return nil, errors.New("db connection refused")
}
