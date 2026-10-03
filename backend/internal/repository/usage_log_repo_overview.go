package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/lib/pq"
)

// 用户用量总览（官网控制台用量页）的查询：合计、每个时间段的合计，以及按需拆分的
// 「时间段 × 模型 / API 密钥 / 分组」。每个查询都只扫一次本用户在时间范围内的使用记录；
// 密钥名与分组名在汇总之后再关联，避免关联放大扫描量。失败请求数不在这里（来自错误日志，由调用方补）。

// usageOverviewTokensExpr 四类 token 合计，与其它用量统计口径一致
const usageOverviewTokensExpr = "input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens"

// GetUserUsageOverview 返回总览。bucketTimezone 为空时按数据库会话时区划分时间段（与 /usage/dashboard/trend 一致），
// 否则按该时区划分，和起止日期用同一个时区，跨时区访问时每天的边界也对得上。
func (r *usageLogRepository) GetUserUsageOverview(ctx context.Context, startTime, endTime time.Time, granularity, bucketTimezone string, filters UsageLogFilters, dims usagestats.UsageOverviewDimensions) (*usagestats.UserUsageOverview, error) {
	where, whereArgs := usageOverviewWhere(startTime, endTime, filters)
	bucketExpr, bucketArgs := usageOverviewBucketExpr(granularity, bucketTimezone, whereArgs)

	overview := &usagestats.UserUsageOverview{
		Buckets: []usagestats.UserUsageOverviewBucket{},
		Models:  []usagestats.UserUsageOverviewSeriesPoint{},
		APIKeys: []usagestats.UserUsageOverviewSeriesPoint{},
		Groups:  []usagestats.UserUsageOverviewSeriesPoint{},
	}

	summary, err := r.usageOverviewSummary(ctx, where, whereArgs)
	if err != nil {
		return nil, fmt.Errorf("usage overview summary: %w", err)
	}
	overview.Summary = summary

	if overview.Buckets, err = r.usageOverviewBuckets(ctx, bucketExpr, where, bucketArgs); err != nil {
		return nil, fmt.Errorf("usage overview buckets: %w", err)
	}
	if dims.Model {
		modelExpr := resolveModelDimensionExpression(usagestats.ModelSourceRequested)
		query := fmt.Sprintf(`
			SELECT %s AS bucket, 0 AS id, %s AS name,
				COUNT(*) AS requests,
				COALESCE(SUM(%s), 0) AS total_tokens,
				COALESCE(SUM(actual_cost), 0) AS actual_cost
			FROM usage_logs
			WHERE %s
			GROUP BY 1, 3
			ORDER BY 1, 3`, bucketExpr, modelExpr, usageOverviewTokensExpr, where)
		if overview.Models, err = r.usageOverviewSeries(ctx, query, bucketArgs); err != nil {
			return nil, fmt.Errorf("usage overview models: %w", err)
		}
	}
	if dims.APIKey {
		query := usageOverviewNamedSeriesQuery(bucketExpr, where, "api_key_id", "api_keys")
		if overview.APIKeys, err = r.usageOverviewSeries(ctx, query, bucketArgs); err != nil {
			return nil, fmt.Errorf("usage overview api keys: %w", err)
		}
	}
	if dims.Group {
		query := usageOverviewNamedSeriesQuery(bucketExpr, where, "COALESCE(group_id, 0)", "groups")
		if overview.Groups, err = r.usageOverviewSeries(ctx, query, bucketArgs); err != nil {
			return nil, fmt.Errorf("usage overview groups: %w", err)
		}
	}
	return overview, nil
}

// usageOverviewWhere 时间范围与筛选条件（不带 WHERE 关键字），口径与趋势、模型统计相同
func usageOverviewWhere(startTime, endTime time.Time, filters UsageLogFilters) (string, []any) {
	query := "created_at >= $1 AND created_at < $2"
	args := []any{startTime, endTime}
	if filters.UserID > 0 {
		query += fmt.Sprintf(" AND user_id = $%d", len(args)+1)
		args = append(args, filters.UserID)
	}
	if len(filters.UserIDs) > 0 {
		query += fmt.Sprintf(" AND user_id = ANY($%d)", len(args)+1)
		args = append(args, pq.Array(filters.UserIDs))
	}
	if filters.APIKeyID > 0 {
		query += fmt.Sprintf(" AND api_key_id = $%d", len(args)+1)
		args = append(args, filters.APIKeyID)
	}
	if filters.AccountID > 0 {
		query += fmt.Sprintf(" AND account_id = $%d", len(args)+1)
		args = append(args, filters.AccountID)
	}
	if filters.GroupID > 0 {
		query += fmt.Sprintf(" AND group_id = $%d", len(args)+1)
		args = append(args, filters.GroupID)
	}
	query, args = appendUsageLogModelQueryFilter(query, args, filters.Model, filters.ModelFilterSource)
	query, args = appendRequestTypeOrStreamQueryFilter(query, args, filters.RequestType, filters.Stream)
	query, args = appendNativeCompactionV2QueryFilter(query, args, filters.NativeCompactionV2, "")
	if filters.BillingType != nil {
		query += fmt.Sprintf(" AND billing_type = $%d", len(args)+1)
		args = append(args, int16(*filters.BillingType))
	}
	query, args = appendUsageLogBillingModeQueryFilter(query, args, filters.BillingMode, "")
	if filters.UpstreamModelMismatch != nil {
		query += " AND " + upstreamModelMismatchCondition("upstream_model_mismatch", *filters.UpstreamModelMismatch)
	}
	return query, args
}

// usageOverviewBucketExpr 时间段表达式。指定时区时把时区作为最后一个参数传入，返回带上它的参数表；
// 汇总查询不用这个参数，所以和筛选参数分开。
func usageOverviewBucketExpr(granularity, bucketTimezone string, whereArgs []any) (string, []any) {
	format := safeDateFormat(granularity)
	if bucketTimezone == "" {
		return fmt.Sprintf("TO_CHAR(created_at, '%s')", format), whereArgs
	}
	args := make([]any, 0, len(whereArgs)+1)
	args = append(args, whereArgs...)
	args = append(args, bucketTimezone)
	return fmt.Sprintf("TO_CHAR(created_at AT TIME ZONE $%d, '%s')", len(args), format), args
}

// usageOverviewNamedSeriesQuery 按密钥或分组拆分：先在使用记录里汇总，再关联名称表取名字
func usageOverviewNamedSeriesQuery(bucketExpr, where, idExpr, nameTable string) string {
	return fmt.Sprintf(`
		WITH agg AS (
			SELECT %s AS bucket, %s AS id,
				COUNT(*) AS requests,
				COALESCE(SUM(%s), 0) AS total_tokens,
				COALESCE(SUM(actual_cost), 0) AS actual_cost
			FROM usage_logs
			WHERE %s
			GROUP BY 1, 2
		)
		SELECT agg.bucket, agg.id, COALESCE(n.name, '') AS name, agg.requests, agg.total_tokens, agg.actual_cost
		FROM agg
		LEFT JOIN %s n ON n.id = agg.id
		ORDER BY agg.bucket, agg.id`, bucketExpr, idExpr, usageOverviewTokensExpr, where, nameTable)
}

func (r *usageLogRepository) usageOverviewSummary(ctx context.Context, where string, args []any) (usagestats.UserUsageOverviewSummary, error) {
	var summary usagestats.UserUsageOverviewSummary
	query := fmt.Sprintf(`
		SELECT
			COUNT(*),
			COALESCE(SUM(input_tokens), 0),
			COALESCE(SUM(output_tokens), 0),
			COALESCE(SUM(cache_creation_tokens), 0),
			COALESCE(SUM(cache_read_tokens), 0),
			COALESCE(SUM(actual_cost), 0),
			COALESCE(AVG(duration_ms), 0),
			COALESCE(AVG(first_token_ms) FILTER (WHERE first_token_ms > 0), 0)
		FROM usage_logs
		WHERE %s`, where)
	err := scanSingleRow(ctx, r.sql, query, args,
		&summary.Requests,
		&summary.InputTokens,
		&summary.OutputTokens,
		&summary.CacheCreationTokens,
		&summary.CacheReadTokens,
		&summary.ActualCost,
		&summary.AverageDurationMs,
		&summary.AverageFirstTokenMs,
	)
	if err != nil {
		return summary, err
	}
	summary.TotalTokens = summary.InputTokens + summary.OutputTokens + summary.CacheCreationTokens + summary.CacheReadTokens
	return summary, nil
}

func (r *usageLogRepository) usageOverviewBuckets(ctx context.Context, bucketExpr, where string, args []any) (results []usagestats.UserUsageOverviewBucket, err error) {
	query := fmt.Sprintf(`
		SELECT %s AS bucket,
			COUNT(*) AS requests,
			COALESCE(SUM(%s), 0) AS total_tokens,
			COALESCE(SUM(actual_cost), 0) AS actual_cost
		FROM usage_logs
		WHERE %s
		GROUP BY 1
		ORDER BY 1`, bucketExpr, usageOverviewTokensExpr, where)
	rows, err := r.sql.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		// 主错误优先；只在没有主错误时回传关闭失败，并清空不完整的结果
		if closeErr := rows.Close(); closeErr != nil && err == nil {
			err = closeErr
			results = nil
		}
	}()

	results = make([]usagestats.UserUsageOverviewBucket, 0)
	for rows.Next() {
		var row usagestats.UserUsageOverviewBucket
		if err := rows.Scan(&row.Bucket, &row.Requests, &row.TotalTokens, &row.ActualCost); err != nil {
			return nil, err
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

func (r *usageLogRepository) usageOverviewSeries(ctx context.Context, query string, args []any) (results []usagestats.UserUsageOverviewSeriesPoint, err error) {
	rows, err := r.sql.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		// 主错误优先；只在没有主错误时回传关闭失败，并清空不完整的结果
		if closeErr := rows.Close(); closeErr != nil && err == nil {
			err = closeErr
			results = nil
		}
	}()

	results = make([]usagestats.UserUsageOverviewSeriesPoint, 0)
	for rows.Next() {
		var row usagestats.UserUsageOverviewSeriesPoint
		if err := rows.Scan(&row.Bucket, &row.ID, &row.Name, &row.Requests, &row.TotalTokens, &row.ActualCost); err != nil {
			return nil, err
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}
