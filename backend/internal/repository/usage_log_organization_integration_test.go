//go:build integration

package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

// 组织用量按成员集合过滤：组织外的记录不能出现在列表、汇总和成员分布里。
func TestUsageLogOrganizationScope(t *testing.T) {
	ctx := context.Background()
	tx := testEntTx(t)
	client := tx.Client()
	repo := newUsageLogRepositoryWithSQL(client, tx)

	suffix := time.Now().UnixNano()
	owner := mustCreateUser(t, client, &service.User{Email: fmt.Sprintf("usage-org-owner-%d@test.com", suffix)})
	member := mustCreateUser(t, client, &service.User{Email: fmt.Sprintf("usage-org-member-%d@test.com", suffix)})
	outsider := mustCreateUser(t, client, &service.User{Email: fmt.Sprintf("usage-org-outsider-%d@test.com", suffix)})
	account := mustCreateAccount(t, client, &service.Account{Name: fmt.Sprintf("usage-org-account-%d", suffix)})

	organization, err := client.Organization.Create().
		SetName("Usage Team").
		SetOwnerUserID(owner.ID).
		Save(ctx)
	require.NoError(t, err)
	for _, userID := range []int64{owner.ID, member.ID} {
		_, err := client.OrganizationMember.Create().
			SetOrganizationID(organization.ID).
			SetUserID(userID).
			Save(ctx)
		require.NoError(t, err)
	}

	now := time.Now().UTC()
	usage := []struct {
		user   *service.User
		tokens int
	}{
		{user: owner, tokens: 10},
		{user: member, tokens: 30},
		{user: outsider, tokens: 50},
	}
	for _, entry := range usage {
		apiKey := mustCreateApiKey(t, client, &service.APIKey{
			UserID: entry.user.ID,
			Key:    fmt.Sprintf("sk-usage-org-%d-%d", entry.user.ID, suffix),
			Name:   "usage org",
		})
		_, err := repo.Create(ctx, &service.UsageLog{
			UserID: entry.user.ID, APIKeyID: apiKey.ID, AccountID: account.ID,
			Model: "gpt-5.5", InputTokens: entry.tokens, OutputTokens: 0,
			TotalCost: 1, ActualCost: 1, CreatedAt: now,
		})
		require.NoError(t, err)
	}

	start := now.Add(-time.Hour)
	end := now.Add(time.Hour)
	organizationFilters := usagestats.UsageLogFilters{
		UserIDs:   []int64{owner.ID, member.ID},
		StartTime: &start,
		EndTime:   &end,
	}

	records, page, err := repo.ListWithFilters(ctx, pagination.DefaultPagination(), organizationFilters)
	require.NoError(t, err)
	require.EqualValues(t, 2, page.Total, "只统计本组织成员的记录")
	for _, record := range records {
		require.NotEqual(t, outsider.ID, record.UserID)
	}

	stats, err := repo.GetStatsWithFilters(ctx, organizationFilters)
	require.NoError(t, err)
	require.EqualValues(t, 2, stats.TotalRequests)
	require.EqualValues(t, 40, stats.TotalInputTokens, "汇总只包含组织内的用量")

	members, err := repo.GetMemberStatsWithUsageFilters(ctx, start, end, organizationFilters)
	require.NoError(t, err)
	require.Len(t, members, 2)
	require.Equal(t, member.ID, members[0].UserID, "成员分布按用量从多到少排列")
	require.EqualValues(t, 30, members[0].TotalTokens)
	require.Equal(t, member.Email, members[0].Email)
	require.Equal(t, owner.ID, members[1].UserID, "组织管理员本人也在成员分布里")

	// 没有限定成员集合时不返回任何成员分布，避免把全平台用量按账号列出来。
	empty, err := repo.GetMemberStatsWithUsageFilters(ctx, start, end, usagestats.UsageLogFilters{
		StartTime: &start, EndTime: &end,
	})
	require.NoError(t, err)
	require.Empty(t, empty)
}
