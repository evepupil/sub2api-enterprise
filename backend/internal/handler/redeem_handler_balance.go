package handler

import (
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

// balanceLedgerMaxPageSize 余额流水每页最多多少条
const balanceLedgerMaxPageSize = 100

// balanceLedgerResponse 一页余额流水，外加这个用户流水里出现过的全部来源（筛选下拉用）
type balanceLedgerResponse struct {
	Items    []service.BalanceLedgerEntry `json:"items"`
	Total    int64                        `json:"total"`
	Page     int                          `json:"page"`
	PageSize int                          `json:"page_size"`
	Pages    int                          `json:"pages"`
	Sources  []string                     `json:"sources"`
}

// GetBalanceSummary 官网控制台账单页的余额卡：可用余额，开户以来的累计充值、赠送、消耗，以及最近 30 天的消耗。
// GET /api/v1/user/balance/summary
func (h *RedeemHandler) GetBalanceSummary(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	summary, err := h.redeemService.GetUserBalanceSummary(c.Request.Context(), subject.UserID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, summary)
}

// GetBalanceLedger 官网控制台账单页的余额流水：只含余额变动（充值、兑换码、优惠码、邀请返利转入、管理员调整、退款），
// 不含每次调用的扣费；每一笔带这笔之后的余额。按时间从新到旧分页。
// GET /api/v1/user/balance/ledger?page=&page_size=&type=&source=&q=&min_amount=&max_amount=&start_date=&end_date=&timezone=
func (h *RedeemHandler) GetBalanceLedger(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}
	filter, ok := parseBalanceLedgerFilter(c)
	if !ok {
		return
	}
	page, pageSize := response.ParsePagination(c)
	pageSize = min(pageSize, balanceLedgerMaxPageSize)

	result, err := h.redeemService.ListUserBalanceLedger(c.Request.Context(), subject.UserID, filter, page, pageSize)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	pages := int(math.Ceil(float64(result.Total) / float64(pageSize)))
	response.Success(c, balanceLedgerResponse{
		Items:    result.Items,
		Total:    result.Total,
		Page:     page,
		PageSize: pageSize,
		Pages:    max(pages, 1),
		Sources:  result.Sources,
	})
}

// parseBalanceLedgerFilter 读筛选参数；不合法时直接回 400 并返回 false。
// 日期按 timezone（缺省为服务器时区）划分，end_date 当天整天算在内。
func parseBalanceLedgerFilter(c *gin.Context) (service.BalanceLedgerFilter, bool) {
	filter := service.BalanceLedgerFilter{
		Type:   strings.TrimSpace(c.Query("type")),
		Source: strings.TrimSpace(c.Query("source")),
		Query:  strings.TrimSpace(c.Query("q")),
	}
	if filter.Type != "" && !slices.Contains(service.BalanceLedgerTypes, filter.Type) {
		response.BadRequest(c, "Invalid type")
		return filter, false
	}
	if len(filter.Query) > 64 {
		response.BadRequest(c, "Search text too long")
		return filter, false
	}

	for _, bound := range []struct {
		name string
		dest **float64
	}{{"min_amount", &filter.MinAmount}, {"max_amount", &filter.MaxAmount}} {
		raw := strings.TrimSpace(c.Query(bound.name))
		if raw == "" {
			continue
		}
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil || value < 0 || math.IsInf(value, 0) || math.IsNaN(value) {
			response.BadRequest(c, "Invalid "+bound.name)
			return filter, false
		}
		*bound.dest = &value
	}
	if filter.MinAmount != nil && filter.MaxAmount != nil && *filter.MinAmount > *filter.MaxAmount {
		response.BadRequest(c, "min_amount must not be greater than max_amount")
		return filter, false
	}

	userTZ := c.Query("timezone")
	if raw := strings.TrimSpace(c.Query("start_date")); raw != "" {
		start, err := timezone.ParseInUserLocation("2006-01-02", raw, userTZ)
		if err != nil {
			response.BadRequest(c, "Invalid start_date format, use YYYY-MM-DD")
			return filter, false
		}
		filter.StartTime = &start
	}
	if raw := strings.TrimSpace(c.Query("end_date")); raw != "" {
		end, err := timezone.ParseInUserLocation("2006-01-02", raw, userTZ)
		if err != nil {
			response.BadRequest(c, "Invalid end_date format, use YYYY-MM-DD")
			return filter, false
		}
		next := end.AddDate(0, 0, 1)
		filter.EndTime = &next
	}
	if filter.StartTime != nil && filter.EndTime != nil && !filter.EndTime.After(*filter.StartTime) {
		response.BadRequest(c, "end_date must not be earlier than start_date")
		return filter, false
	}
	return filter, true
}
