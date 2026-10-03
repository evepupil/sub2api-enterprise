//go:build unit

package repository

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/stretchr/testify/require"
)

var overviewSeriesColumns = []string{"bucket", "id", "name", "requests", "total_tokens", "actual_cost"}

func TestGetUserUsageOverviewSplitsByTimezoneAndDimensions(t *testing.T) {
	db, mock := newSQLMock(t)
	repo := &usageLogRepository{sql: db}
	start := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(30 * 24 * time.Hour)
	filters := UsageLogFilters{UserID: 42}

	// 合计不按时间段分，不带时区参数
	mock.ExpectQuery(regexp.QuoteMeta("COALESCE(AVG(first_token_ms) FILTER (WHERE first_token_ms > 0), 0)")).
		WithArgs(start, end, int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"requests", "input", "output", "cache_creation", "cache_read", "actual_cost", "avg_duration", "avg_first_token"}).
			AddRow(int64(5), int64(100), int64(40), int64(10), int64(50), 0.75, 1200.5, 810.0))
	// 每个时间段的合计：按请求给的时区划分，时区作为最后一个参数
	mock.ExpectQuery(regexp.QuoteMeta("TO_CHAR(created_at AT TIME ZONE $4, 'YYYY-MM-DD')")).
		WithArgs(start, end, int64(42), "Asia/Shanghai").
		WillReturnRows(sqlmock.NewRows([]string{"bucket", "requests", "total_tokens", "actual_cost"}).
			AddRow("2026-09-02", int64(5), int64(200), 0.75))
	mock.ExpectQuery(regexp.QuoteMeta("COALESCE(NULLIF(TRIM(requested_model), ''), model) AS name")).
		WithArgs(start, end, int64(42), "Asia/Shanghai").
		WillReturnRows(sqlmock.NewRows(overviewSeriesColumns).
			AddRow("2026-09-02", int64(0), "gpt-5", int64(3), int64(150), 0.5).
			AddRow("2026-09-02", int64(0), "claude-sonnet-4.5", int64(2), int64(50), 0.25))
	mock.ExpectQuery(regexp.QuoteMeta("LEFT JOIN api_keys n ON n.id = agg.id")).
		WithArgs(start, end, int64(42), "Asia/Shanghai").
		WillReturnRows(sqlmock.NewRows(overviewSeriesColumns).
			AddRow("2026-09-02", int64(7), "prod", int64(5), int64(200), 0.75))
	mock.ExpectQuery(regexp.QuoteMeta("COALESCE(group_id, 0) AS id")).
		WithArgs(start, end, int64(42), "Asia/Shanghai").
		WillReturnRows(sqlmock.NewRows(overviewSeriesColumns).
			AddRow("2026-09-02", int64(0), "", int64(1), int64(20), 0.05).
			AddRow("2026-09-02", int64(3), "共享通道", int64(4), int64(180), 0.7))

	overview, err := repo.GetUserUsageOverview(context.Background(), start, end, "day", "Asia/Shanghai", filters,
		usagestats.UsageOverviewDimensions{Model: true, APIKey: true, Group: true})

	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
	require.Equal(t, int64(5), overview.Summary.Requests)
	require.Equal(t, int64(200), overview.Summary.TotalTokens)
	require.InDelta(t, 810.0, overview.Summary.AverageFirstTokenMs, 0.001)
	require.Nil(t, overview.Summary.FailedRequests)
	require.Equal(t, []usagestats.UserUsageOverviewBucket{{Bucket: "2026-09-02", Requests: 5, TotalTokens: 200, ActualCost: 0.75}}, overview.Buckets)
	require.Len(t, overview.Models, 2)
	require.Equal(t, "gpt-5", overview.Models[0].Name)
	require.Equal(t, usagestats.UserUsageOverviewSeriesPoint{Bucket: "2026-09-02", ID: 7, Name: "prod", Requests: 5, TotalTokens: 200, ActualCost: 0.75}, overview.APIKeys[0])
	require.Equal(t, "共享通道", overview.Groups[1].Name)
}

func TestGetUserUsageOverviewWithoutDimensionsOrTimezone(t *testing.T) {
	db, mock := newSQLMock(t)
	repo := &usageLogRepository{sql: db}
	start := time.Date(2025, 10, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(370 * 24 * time.Hour)
	filters := UsageLogFilters{UserID: 42, APIKeyID: 7}

	mock.ExpectQuery("FROM usage_logs").
		WithArgs(start, end, int64(42), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"requests", "input", "output", "cache_creation", "cache_read", "actual_cost", "avg_duration", "avg_first_token"}).
			AddRow(int64(0), int64(0), int64(0), int64(0), int64(0), 0.0, 0.0, 0.0))
	// 没给时区：按数据库会话时区划分，参数里没有时区
	mock.ExpectQuery(regexp.QuoteMeta("TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')")).
		WithArgs(start, end, int64(42), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"bucket", "requests", "total_tokens", "actual_cost"}))

	overview, err := repo.GetUserUsageOverview(context.Background(), start, end, "hour", "", filters, usagestats.UsageOverviewDimensions{})

	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
	require.Empty(t, overview.Buckets)
	require.NotNil(t, overview.Models)
	require.Empty(t, overview.Models)
	require.Empty(t, overview.APIKeys)
	require.Empty(t, overview.Groups)
}
