package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
)

// UserUsageOverviewRepository 用户用量总览的查询能力。单独成接口而不并入 UsageLogRepository，
// 免得所有用量仓库的测试替身都要跟着实现；仓库没实现时总览接口返回错误。
type UserUsageOverviewRepository interface {
	GetUserUsageOverview(ctx context.Context, startTime, endTime time.Time, granularity, bucketTimezone string, filters usagestats.UsageLogFilters, dims usagestats.UsageOverviewDimensions) (*usagestats.UserUsageOverview, error)
}

// errUsageOverviewUnsupported 用量仓库没有实现总览查询
var errUsageOverviewUnsupported = errors.New("usage overview is not supported by the usage repository")

// GetUserUsageOverview 官网控制台用量页的总览：合计、每个时间段的合计与按需拆分的维度。
// 失败请求数由调用方另行补上（来自错误日志）。
func (s *UsageService) GetUserUsageOverview(ctx context.Context, startTime, endTime time.Time, granularity, bucketTimezone string, filters usagestats.UsageLogFilters, dims usagestats.UsageOverviewDimensions) (*usagestats.UserUsageOverview, error) {
	repo, ok := s.usageRepo.(UserUsageOverviewRepository)
	if !ok {
		return nil, errUsageOverviewUnsupported
	}
	overview, err := repo.GetUserUsageOverview(ctx, startTime, endTime, granularity, bucketTimezone, filters, dims)
	if err != nil {
		return nil, fmt.Errorf("get user usage overview: %w", err)
	}
	return overview, nil
}
