package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// overviewRepoCapture 记下总览查询收到的参数，返回固定结果
type overviewRepoCapture struct {
	service.UsageLogRepository
	calls          int
	start, end     time.Time
	granularity    string
	bucketTimezone string
	filters        usagestats.UsageLogFilters
	dims           usagestats.UsageOverviewDimensions
}

func (r *overviewRepoCapture) GetUserUsageOverview(ctx context.Context, startTime, endTime time.Time, granularity, bucketTimezone string, filters usagestats.UsageLogFilters, dims usagestats.UsageOverviewDimensions) (*usagestats.UserUsageOverview, error) {
	r.calls++
	r.start, r.end = startTime, endTime
	r.granularity, r.bucketTimezone = granularity, bucketTimezone
	r.filters, r.dims = filters, dims
	return &usagestats.UserUsageOverview{
		Summary: usagestats.UserUsageOverviewSummary{Requests: 12, TotalTokens: 3400, ActualCost: 1.25, AverageFirstTokenMs: 820},
		Buckets: []usagestats.UserUsageOverviewBucket{{Bucket: "2026-09-02", Requests: 12, TotalTokens: 3400, ActualCost: 1.25}},
		Models:  []usagestats.UserUsageOverviewSeriesPoint{{Bucket: "2026-09-02", Name: "gpt-5", Requests: 12, TotalTokens: 3400, ActualCost: 1.25}},
		APIKeys: []usagestats.UserUsageOverviewSeriesPoint{{Bucket: "2026-09-02", ID: 7, Name: "prod", Requests: 12, TotalTokens: 3400, ActualCost: 1.25}},
		Groups:  []usagestats.UserUsageOverviewSeriesPoint{},
	}, nil
}

// overviewOpsRepo 错误日志的替身：只实现按用户查失败请求，记下筛选条件
type overviewOpsRepo struct {
	service.OpsRepository
	filter *service.OpsErrorLogFilter
	total  int
}

func (r *overviewOpsRepo) ListErrorLogs(ctx context.Context, filter *service.OpsErrorLogFilter) (*service.OpsErrorLogList, error) {
	r.filter = filter
	return &service.OpsErrorLogList{Errors: []*service.OpsErrorLog{}, Total: r.total, Page: 1, PageSize: 1}, nil
}

func newUsageOverviewTestRouter(repo service.UsageLogRepository, ops *service.OpsService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewUsageHandler(service.NewUsageService(repo, nil, nil, nil), nil, ops, nil)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware2.ContextKeyUser), middleware2.AuthSubject{UserID: 42})
		c.Next()
	})
	router.GET("/usage/dashboard/overview", handler.DashboardOverview)
	return router
}

func getUsageOverview(t *testing.T, router *gin.Engine, query string) (int, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/usage/dashboard/overview?"+query, nil))
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	data, _ := body["data"].(map[string]any)
	return rec.Code, data
}

// overviewObject 取 JSON 里的一个对象，不是对象时让测试失败
func overviewObject(t *testing.T, value any) map[string]any {
	t.Helper()
	object, ok := value.(map[string]any)
	require.True(t, ok, "expected a JSON object, got %T", value)
	return object
}

func TestUsageOverviewPassesRangeTimezoneAndDimensions(t *testing.T) {
	repo := &overviewRepoCapture{}
	router := newUsageOverviewTestRouter(repo, nil)

	code, data := getUsageOverview(t, router, "start_date=2026-09-01&end_date=2026-09-30&timezone=Asia/Shanghai&dimensions=model,api_key")

	require.Equal(t, http.StatusOK, code)
	require.Equal(t, 1, repo.calls)
	shanghai, err := time.LoadLocation("Asia/Shanghai")
	require.NoError(t, err)
	require.True(t, repo.start.Equal(time.Date(2026, 9, 1, 0, 0, 0, 0, shanghai)))
	require.True(t, repo.end.Equal(time.Date(2026, 10, 1, 0, 0, 0, 0, shanghai)))
	require.Equal(t, "day", repo.granularity)
	require.Equal(t, "Asia/Shanghai", repo.bucketTimezone)
	require.Equal(t, int64(42), repo.filters.UserID)
	require.Equal(t, usagestats.UsageOverviewDimensions{Model: true, APIKey: true}, repo.dims)

	require.Equal(t, "2026-09-01", data["start_date"])
	require.Equal(t, "2026-09-30", data["end_date"])
	summary := overviewObject(t, data["summary"])
	require.EqualValues(t, 12, summary["requests"])
	require.EqualValues(t, 820, summary["average_first_token_ms"])
	// 没有错误日志服务时失败数为 null，页面不显示成功率
	require.Contains(t, summary, "failed_requests")
	require.Nil(t, summary["failed_requests"])
	keys, ok := data["api_keys"].([]any)
	require.True(t, ok)
	require.Len(t, keys, 1)
	require.Equal(t, "prod", overviewObject(t, keys[0])["name"])
}

func TestUsageOverviewRejectsBadParameters(t *testing.T) {
	repo := &overviewRepoCapture{}
	router := newUsageOverviewTestRouter(repo, nil)

	for _, query := range []string{
		"start_date=2026-09-01&end_date=2026-09-30&granularity=week",
		"start_date=2026-09-01&end_date=2026-09-30&dimensions=model,account",
		"start_date=2026-09-30&end_date=2026-09-01",
		// 按小时最多 31 天
		"start_date=2026-08-01&end_date=2026-09-30&granularity=hour",
		// 按天最多约三年
		"start_date=2022-01-01&end_date=2026-09-30",
	} {
		code, _ := getUsageOverview(t, router, query)
		require.Equal(t, http.StatusBadRequest, code, query)
	}
	require.Zero(t, repo.calls)

	code, _ := getUsageOverview(t, router, "start_date=2026-09-30&end_date=2026-09-30&granularity=hour")
	require.Equal(t, http.StatusOK, code)
	require.Equal(t, "hour", repo.granularity)
	require.Equal(t, usagestats.UsageOverviewDimensions{}, repo.dims)
}

func TestUsageOverviewCountsFailedRequestsFromErrorLogs(t *testing.T) {
	opsRepo := &overviewOpsRepo{total: 3}
	ops := service.NewOpsService(opsRepo, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	router := newUsageOverviewTestRouter(&overviewRepoCapture{}, ops)

	code, data := getUsageOverview(t, router, "start_date=2026-09-01&end_date=2026-09-30&timezone=Asia/Shanghai")

	require.Equal(t, http.StatusOK, code)
	require.EqualValues(t, 3, overviewObject(t, data["summary"])["failed_requests"])
	require.NotNil(t, opsRepo.filter)
	require.NotNil(t, opsRepo.filter.UserID)
	require.Equal(t, int64(42), *opsRepo.filter.UserID)
	require.Equal(t, 1, opsRepo.filter.PageSize)
	require.NotNil(t, opsRepo.filter.StartTime)
	require.NotNil(t, opsRepo.filter.EndTime)
	require.Equal(t, 29*24*time.Hour+24*time.Hour, opsRepo.filter.EndTime.Sub(*opsRepo.filter.StartTime))
}

func TestUsageOverviewCountsFailuresOnlyForOwnUnfilteredUsage(t *testing.T) {
	own := usagestats.UsageLogFilters{UserID: 42, APIKeyID: 7}
	require.True(t, usageOverviewCountsFailures(own, 42))

	byGroup := own
	byGroup.GroupID = 3
	require.False(t, usageOverviewCountsFailures(byGroup, 42))

	byModel := own
	byModel.Model = "gpt-5"
	require.False(t, usageOverviewCountsFailures(byModel, 42))

	// 组织范围：用户条件换成了成员集合
	organization := usagestats.UsageLogFilters{UserIDs: []int64{42, 43}}
	require.False(t, usageOverviewCountsFailures(organization, 42))
}

func TestUsageOverviewWithoutRepositorySupportFails(t *testing.T) {
	router := newUsageOverviewTestRouter(&userUsageRepoCapture{}, nil)
	code, _ := getUsageOverview(t, router, "start_date=2026-09-01&end_date=2026-09-30")
	require.Equal(t, http.StatusInternalServerError, code)
}
