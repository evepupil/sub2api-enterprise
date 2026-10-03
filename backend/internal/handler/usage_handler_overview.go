package handler

import (
	"fmt"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	// usageOverviewMaxDays 按天时最长的范围：约三年，够控制台「全部」时间用
	usageOverviewMaxDays = 1100
	// usageOverviewMaxHourDays 按小时时最长的范围，避免一次返回过多时间段
	usageOverviewMaxHourDays = 31
)

// DashboardOverview 官网控制台用量页的总览：合计（含平均首字耗时与失败请求数）、每个时间段的合计，
// 以及按需拆分的「时间段 × 模型 / API 密钥 / 分组」。一次请求给齐，页面不必为每个系列单独查趋势。
// GET /api/v1/usage/dashboard/overview?start_date=&end_date=&timezone=&granularity=day|hour&dimensions=model,api_key,group
// 其余筛选参数（scope、api_key_id、group_id、model 等）与其它用量接口相同。
func (h *UsageHandler) DashboardOverview(c *gin.Context) {
	parsed, ok := h.parseUserUsageFilters(c, true)
	if !ok {
		return
	}

	granularity := strings.TrimSpace(c.DefaultQuery("granularity", "day"))
	if granularity != "day" && granularity != "hour" {
		response.BadRequest(c, "Invalid granularity, use day or hour")
		return
	}
	dims, ok := parseUsageOverviewDimensions(c.Query("dimensions"))
	if !ok {
		response.BadRequest(c, "Invalid dimensions, use model, api_key or group")
		return
	}
	if !parsed.EndTime.After(parsed.StartTime) {
		response.BadRequest(c, "end_date must not be earlier than start_date")
		return
	}
	maxDays := usageOverviewMaxDays
	if granularity == "hour" {
		maxDays = usageOverviewMaxHourDays
	}
	if parsed.EndTime.Sub(parsed.StartTime) > time.Duration(maxDays)*24*time.Hour {
		response.BadRequest(c, fmt.Sprintf("Date range too large for %s granularity (max %d days)", granularity, maxDays))
		return
	}

	bucketTimezone := usageOverviewBucketTimezone(c.Query("timezone"))
	overview, err := h.usageService.GetUserUsageOverview(c.Request.Context(), parsed.StartTime, parsed.EndTime, granularity, bucketTimezone, parsed.Filters, dims)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	overview.Summary.FailedRequests = h.usageOverviewFailedRequests(c, parsed)

	response.Success(c, gin.H{
		"start_date":  parsed.StartTime.Format("2006-01-02"),
		"end_date":    parsed.EndTime.Add(-24 * time.Hour).Format("2006-01-02"),
		"granularity": granularity,
		"timezone":    bucketTimezone,
		"summary":     overview.Summary,
		"buckets":     overview.Buckets,
		"models":      overview.Models,
		"api_keys":    overview.APIKeys,
		"groups":      overview.Groups,
	})
}

// parseUsageOverviewDimensions 解析逗号分隔的维度；空串表示都不拆，出现不认识的维度返回 false
func parseUsageOverviewDimensions(raw string) (usagestats.UsageOverviewDimensions, bool) {
	var dims usagestats.UsageOverviewDimensions
	for _, part := range strings.Split(raw, ",") {
		switch strings.TrimSpace(part) {
		case "":
		case usagestats.UsageOverviewDimensionModel:
			dims.Model = true
		case usagestats.UsageOverviewDimensionAPIKey:
			dims.APIKey = true
		case usagestats.UsageOverviewDimensionGroup:
			dims.Group = true
		default:
			return dims, false
		}
	}
	return dims, true
}

// usageOverviewBucketTimezone 时间段按哪个时区划分：请求给的时区有效就用它（和起止日期的解析一致），
// 否则用服务器配置的时区；两者都没有时返回空串，由数据库会话时区决定。
func usageOverviewBucketTimezone(userTZ string) string {
	if tz := strings.TrimSpace(userTZ); tz != "" && tz != "Local" {
		if _, err := time.LoadLocation(tz); err == nil {
			return tz
		}
	}
	if name := timezone.Name(); name != "Local" {
		return name
	}
	return ""
}

// usageOverviewCountsFailures 失败请求数只在看自己的用量、且除时间与密钥外没有别的筛选时统计：
// 错误日志没有分组、计费方式等维度，带了这些筛选就和用量合计对不上口径。
func usageOverviewCountsFailures(filters usagestats.UsageLogFilters, actorUserID int64) bool {
	return filters.UserID == actorUserID &&
		len(filters.UserIDs) == 0 &&
		filters.AccountID == 0 &&
		filters.GroupID == 0 &&
		strings.TrimSpace(filters.Model) == "" &&
		filters.RequestType == nil &&
		filters.Stream == nil &&
		filters.BillingType == nil &&
		filters.BillingMode == "" &&
		filters.NativeCompactionV2 == nil &&
		filters.UpstreamModelMismatch == nil
}

// usageOverviewFailedRequests 同一时间范围内最终失败的请求数，口径与「失败请求」列表相同
// （排除已自动恢复的上游错误与 count_tokens）。只给数字不给明细，所以不受「允许用户查看失败请求」开关限制。
// 错误日志不可用或查询失败时返回 nil，页面据此不显示成功率。
func (h *UsageHandler) usageOverviewFailedRequests(c *gin.Context, parsed *userUsageFilters) *int64 {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok || h.opsService == nil || !usageOverviewCountsFailures(parsed.Filters, subject.UserID) {
		return nil
	}
	start, end := parsed.StartTime, parsed.EndTime
	filter := &service.OpsErrorLogFilter{Page: 1, PageSize: 1, StartTime: &start, EndTime: &end}
	if parsed.Filters.APIKeyID > 0 {
		apiKeyID := parsed.Filters.APIKeyID
		filter.APIKeyID = &apiKeyID
	}
	list, err := h.opsService.ListUserErrorRequests(c.Request.Context(), subject.UserID, filter)
	if err != nil {
		_ = c.Error(err) // 只记日志，总览照常返回
		return nil
	}
	total := int64(list.Total)
	return &total
}
