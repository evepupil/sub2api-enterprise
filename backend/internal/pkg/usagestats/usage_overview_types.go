package usagestats

// 用户用量总览：官网控制台用量页一次要的全部数字。
// 和 /usage/stats、/usage/dashboard/trend 等接口的区别是：按天（或按小时）× 模型 / API 密钥 / 分组
// 拆开的用量在一次请求里给齐，并带上平均首字耗时与失败请求数。

// 总览里可以按需拆分的维度
const (
	UsageOverviewDimensionModel  = "model"
	UsageOverviewDimensionAPIKey = "api_key"
	UsageOverviewDimensionGroup  = "group"
)

// UsageOverviewDimensions 本次要拆分的维度；都不要时只给合计与每个时间段的合计（热力图用）
type UsageOverviewDimensions struct {
	Model  bool
	APIKey bool
	Group  bool
}

// UserUsageOverview 用户用量总览
type UserUsageOverview struct {
	Summary UserUsageOverviewSummary `json:"summary"`
	// Buckets 每个时间段（天：YYYY-MM-DD；小时：YYYY-MM-DD HH24:00）的合计，只含有用量的时间段
	Buckets []UserUsageOverviewBucket `json:"buckets"`
	// 以下三项只在请求了对应维度时有内容；每行是「一个时间段 × 一个模型 / 密钥 / 分组」
	Models  []UserUsageOverviewSeriesPoint `json:"models"`
	APIKeys []UserUsageOverviewSeriesPoint `json:"api_keys"`
	Groups  []UserUsageOverviewSeriesPoint `json:"groups"`
}

// UserUsageOverviewSummary 所选时间范围内的合计
type UserUsageOverviewSummary struct {
	Requests            int64   `json:"requests"`
	InputTokens         int64   `json:"input_tokens"`
	OutputTokens        int64   `json:"output_tokens"`
	CacheCreationTokens int64   `json:"cache_creation_tokens"`
	CacheReadTokens     int64   `json:"cache_read_tokens"`
	TotalTokens         int64   `json:"total_tokens"`
	ActualCost          float64 `json:"actual_cost"` // 实际扣除
	AverageDurationMs   float64 `json:"average_duration_ms"`
	// AverageFirstTokenMs 只统计记录了首字耗时的请求（流式文本请求）；没有这类请求时为 0
	AverageFirstTokenMs float64 `json:"average_first_token_ms"`
	// FailedRequests 同一时间范围内最终失败的请求数（来自错误日志）；拿不到时为 null，界面不显示成功率
	FailedRequests *int64 `json:"failed_requests"`
}

// UserUsageOverviewBucket 一个时间段的合计
type UserUsageOverviewBucket struct {
	Bucket      string  `json:"bucket"`
	Requests    int64   `json:"requests"`
	TotalTokens int64   `json:"total_tokens"`
	ActualCost  float64 `json:"actual_cost"`
}

// UserUsageOverviewSeriesPoint 一个时间段里某个模型 / 密钥 / 分组的用量。
// 模型维度 ID 为 0、Name 是模型名；密钥与分组维度 ID 是密钥或分组的 ID，Name 是名称
// （没有分组的请求 ID 为 0、Name 为空）。
type UserUsageOverviewSeriesPoint struct {
	Bucket      string  `json:"bucket"`
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Requests    int64   `json:"requests"`
	TotalTokens int64   `json:"total_tokens"`
	ActualCost  float64 `json:"actual_cost"`
}
