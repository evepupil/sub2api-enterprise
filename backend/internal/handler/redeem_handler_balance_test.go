package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// balanceLedgerRepoCapture 兑换码仓库的替身：只实现余额流水两个查询，记下收到的参数，返回固定结果
type balanceLedgerRepoCapture struct {
	service.RedeemCodeRepository
	summaryCalls int
	ledgerCalls  int
	userID       int64
	recentSince  time.Time
	filter       service.BalanceLedgerFilter
	page         int
	pageSize     int
}

func (r *balanceLedgerRepoCapture) GetUserBalanceSummary(ctx context.Context, userID int64, recentSince time.Time) (*service.BalanceSummary, error) {
	r.summaryCalls++
	r.userID, r.recentSince = userID, recentSince
	return &service.BalanceSummary{Balance: 131.2, TotalRecharged: 2.8, TotalBonus: 0, TotalConsumed: 15.0864, RecentConsumed: 4.5}, nil
}

func (r *balanceLedgerRepoCapture) ListUserBalanceLedger(ctx context.Context, userID int64, filter service.BalanceLedgerFilter, page, pageSize int) (*service.BalanceLedgerPage, error) {
	r.ledgerCalls++
	r.userID, r.filter, r.page, r.pageSize = userID, filter, page, pageSize
	pay := 20.4
	return &service.BalanceLedgerPage{
		Items: []service.BalanceLedgerEntry{{
			ID: "rc_1", Type: service.BalanceLedgerTypeRecharge, Source: "alipay", Amount: 2.8, BalanceAfter: 131.2,
			Reference: "sub2_20260927i7leCzsB", PayAmount: &pay, CreatedAt: time.Date(2026, 9, 27, 6, 47, 37, 0, time.UTC),
		}},
		Total:   41,
		Sources: []string{"alipay", "redeem_code"},
	}, nil
}

func newBalanceTestRouter(repo service.RedeemCodeRepository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewRedeemHandler(service.NewRedeemService(repo, nil, nil, nil, nil, nil, nil, nil))
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware2.ContextKeyUser), middleware2.AuthSubject{UserID: 42})
		c.Next()
	})
	router.GET("/user/balance/summary", handler.GetBalanceSummary)
	router.GET("/user/balance/ledger", handler.GetBalanceLedger)
	return router
}

func getBalanceJSON(t *testing.T, router *gin.Engine, path string) (int, map[string]any) {
	t.Helper()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	data, _ := body["data"].(map[string]any)
	return rec.Code, data
}

func TestBalanceSummaryReturnsTotalsAndRecentWindow(t *testing.T) {
	repo := &balanceLedgerRepoCapture{}
	before := time.Now()
	code, data := getBalanceJSON(t, newBalanceTestRouter(repo), "/user/balance/summary")

	require.Equal(t, http.StatusOK, code)
	require.Equal(t, 1, repo.summaryCalls)
	require.Equal(t, int64(42), repo.userID)
	// 最近 30 天从此刻往前算
	require.WithinDuration(t, before.Add(-30*24*time.Hour), repo.recentSince, 5*time.Second)
	require.EqualValues(t, 131.2, data["balance"])
	require.EqualValues(t, 2.8, data["total_recharged"])
	require.EqualValues(t, 0, data["total_bonus"])
	require.EqualValues(t, 15.0864, data["total_consumed"])
	require.EqualValues(t, 4.5, data["recent_consumed"])
	require.EqualValues(t, 30, data["recent_days"])
}

func TestBalanceLedgerPassesFiltersAndPaging(t *testing.T) {
	repo := &balanceLedgerRepoCapture{}
	code, data := getBalanceJSON(t, newBalanceTestRouter(repo),
		"/user/balance/ledger?page=3&page_size=20&type=recharge&source=alipay&q=sub2_&min_amount=1&max_amount=50&start_date=2026-09-01&end_date=2026-09-30&timezone=Asia/Shanghai")

	require.Equal(t, http.StatusOK, code)
	require.Equal(t, 1, repo.ledgerCalls)
	require.Equal(t, int64(42), repo.userID)
	require.Equal(t, 3, repo.page)
	require.Equal(t, 20, repo.pageSize)
	require.Equal(t, "recharge", repo.filter.Type)
	require.Equal(t, "alipay", repo.filter.Source)
	require.Equal(t, "sub2_", repo.filter.Query)
	require.NotNil(t, repo.filter.MinAmount)
	require.NotNil(t, repo.filter.MaxAmount)
	require.EqualValues(t, 1, *repo.filter.MinAmount)
	require.EqualValues(t, 50, *repo.filter.MaxAmount)
	// 日期按传入的时区划分，结束日当天整天算在内
	shanghai, err := time.LoadLocation("Asia/Shanghai")
	require.NoError(t, err)
	require.True(t, repo.filter.StartTime.Equal(time.Date(2026, 9, 1, 0, 0, 0, 0, shanghai)))
	require.True(t, repo.filter.EndTime.Equal(time.Date(2026, 10, 1, 0, 0, 0, 0, shanghai)))

	require.EqualValues(t, 41, data["total"])
	require.EqualValues(t, 3, data["page"])
	require.EqualValues(t, 20, data["page_size"])
	require.EqualValues(t, 3, data["pages"])
	require.Equal(t, []any{"alipay", "redeem_code"}, data["sources"])
	items, ok := data["items"].([]any)
	require.True(t, ok)
	require.Len(t, items, 1)
	item, ok := items[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "rc_1", item["id"])
	require.Equal(t, "recharge", item["type"])
	require.EqualValues(t, 131.2, item["balance_after"])
	require.EqualValues(t, 20.4, item["pay_amount"])
}

func TestBalanceLedgerCapsPageSize(t *testing.T) {
	repo := &balanceLedgerRepoCapture{}
	code, _ := getBalanceJSON(t, newBalanceTestRouter(repo), "/user/balance/ledger?page_size=500")

	require.Equal(t, http.StatusOK, code)
	require.Equal(t, 1, repo.page)
	require.Equal(t, 100, repo.pageSize)
	require.Nil(t, repo.filter.StartTime)
	require.Nil(t, repo.filter.EndTime)
}

func TestBalanceLedgerRejectsBadParameters(t *testing.T) {
	repo := &balanceLedgerRepoCapture{}
	router := newBalanceTestRouter(repo)

	for _, query := range []string{
		"type=consumption",
		"min_amount=-1",
		"max_amount=abc",
		"min_amount=10&max_amount=5",
		"start_date=2026-09-31",
		"start_date=2026-09-30&end_date=2026-09-01",
	} {
		code, _ := getBalanceJSON(t, router, "/user/balance/ledger?"+query)
		require.Equal(t, http.StatusBadRequest, code, query)
	}
	require.Equal(t, 0, repo.ledgerCalls)
}

func TestBalanceEndpointsFailWithoutLedgerSupport(t *testing.T) {
	// 兑换码仓库没实现余额流水查询时两个接口都报错，不返回空数据冒充
	router := newBalanceTestRouter(struct{ service.RedeemCodeRepository }{})

	code, _ := getBalanceJSON(t, router, "/user/balance/summary")
	require.Equal(t, http.StatusInternalServerError, code)
	code, _ = getBalanceJSON(t, router, "/user/balance/ledger")
	require.Equal(t, http.StatusInternalServerError, code)
}
