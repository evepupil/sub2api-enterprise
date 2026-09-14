package service

import (
	"context"
	"sync"
	"time"
)

// 对外服务状态页。
//
// 数据源是管理员在后台配置的**渠道监测**（主动探测），不是被动流量聚合。
// 选它有两个原因：探测项由管理员显式创建，天然就是「哪些东西要对外公示」的
// 开关；而且没有调用量时探测照样有信号，被动聚合在零流量时只能显示无数据。
//
// 这里不做任何采集或统计——状态、延迟、7 天可用率、时间线都由
// ChannelMonitorService.ListUserView 算好，本服务只负责再脱一道敏。
//
// 脱敏原则（加字段前先读这段）：
//   - 不出 Provider。那是上游厂商标识，等于把供应链写在官网上。
//   - 不出模型名。同上，且模型清单属于商务信息。
//   - 不出配额快照。那是我们自己账号的余量。
//   - 不出监测项 ID 与内部错误信息。
//   - 监测项名称和分组名原样外发，所以后台命名本身就是对外文案。
//
// 默认关闭，由平台管理员显式打开；读不到设置按关闭处理。

// PublicStatusLevel 是对外展示的状态档位。
type PublicStatusLevel string

const (
	// PublicStatusOperational 正常。
	PublicStatusOperational PublicStatusLevel = "operational"
	// PublicStatusDegraded 性能下降，仍可用。
	PublicStatusDegraded PublicStatusLevel = "degraded"
	// PublicStatusOutage 不可用。
	PublicStatusOutage PublicStatusLevel = "outage"
	// PublicStatusUnknown 尚无探测结果。
	PublicStatusUnknown PublicStatusLevel = "unknown"
)

// PublicStatusPoint 是状态条上的一格，对应一次探测。
type PublicStatusPoint struct {
	Status    PublicStatusLevel `json:"status"`
	CheckedAt time.Time         `json:"checked_at"`
}

// PublicStatusComponent 是状态页上的一行，对应一个监测项。
type PublicStatusComponent struct {
	Name      string            `json:"name"`
	GroupName string            `json:"group_name,omitempty"`
	Status    PublicStatusLevel `json:"status"`
	// APIMode 是探测走的接口形态（chat_completions / responses），
	// 协议标识不含厂商信息，作为标签展示。
	APIMode string `json:"api_mode,omitempty"`
	// Availability7d 是近 7 天可用率（0-100），由监测服务算好。
	Availability7d float64 `json:"availability_7d"`
	// LatencyMs 是最近一次探测的响应耗时，未取到时为 nil。
	LatencyMs *int `json:"latency_ms"`
	// PingLatencyMs 是最近一次探测的网络往返耗时，未取到时为 nil。
	// 和 LatencyMs 分开给：前者衡量链路，后者含上游生成时间。
	PingLatencyMs *int                `json:"ping_latency_ms"`
	Timeline      []PublicStatusPoint `json:"timeline"`
}

// PublicStatus 是对外状态页的完整响应。
type PublicStatus struct {
	Status     PublicStatusLevel `json:"status"`
	UpdatedAt  time.Time         `json:"updated_at"`
	WindowDays int               `json:"window_days"`
	// Availability7d 是所有监测项可用率的算术平均，没有监测项时为 0。
	// 不按流量加权：对外只声明「探测口径的平均可用率」，加权需要流量数据，
	// 而流量数据本身不对外。
	Availability7d float64 `json:"availability_7d"`
	// OperationalCount / TotalCount 用于「N / M 项正常」。
	OperationalCount int                     `json:"operational_count"`
	TotalCount       int                     `json:"total_count"`
	Components       []PublicStatusComponent `json:"components"`
}

// publicStatusMonitorReader 是本服务依赖的那一小块监测能力。
// 声明成接口而不是直接绑具体服务，方便单测塞假数据。
type publicStatusMonitorReader interface {
	ListUserView(ctx context.Context) ([]*UserMonitorView, error)
}

type publicStatusSettingReader interface {
	IsPublicStatusEnabled(ctx context.Context) bool
}

// PublicStatusService 把已有的渠道监测结果收口成对外可见的状态。
type PublicStatusService struct {
	monitor  publicStatusMonitorReader
	settings publicStatusSettingReader

	// 匿名接口扛得住被刷，结果整体缓存一份。
	mu       sync.RWMutex
	cached   *PublicStatus
	cachedAt time.Time
	ttl      time.Duration
}

// NewPublicStatusService 创建对外状态服务。
func NewPublicStatusService(monitor publicStatusMonitorReader, settings publicStatusSettingReader) *PublicStatusService {
	return &PublicStatusService{
		monitor:  monitor,
		settings: settings,
		ttl:      60 * time.Second,
	}
}

// publicStatusWindowDays 与监测服务的 7 天可用率窗口对齐。
const publicStatusWindowDays = 7

// Enabled 报告平台是否对外开放状态页。
func (s *PublicStatusService) Enabled(ctx context.Context) bool {
	if s == nil || s.settings == nil {
		return false
	}
	return s.settings.IsPublicStatusEnabled(ctx)
}

// Get 返回脱敏后的服务状态。
func (s *PublicStatusService) Get(ctx context.Context) (*PublicStatus, error) {
	if s == nil || s.monitor == nil {
		return nil, ErrServiceUnavailable
	}

	if cached := s.readCache(); cached != nil {
		return cached, nil
	}

	views, err := s.monitor.ListUserView(ctx)
	if err != nil {
		return nil, err
	}

	status := buildPublicStatus(views, time.Now())
	s.writeCache(status)
	return status, nil
}

func (s *PublicStatusService) readCache() *PublicStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.cached == nil || time.Since(s.cachedAt) > s.ttl {
		return nil
	}
	return s.cached
}

func (s *PublicStatusService) writeCache(status *PublicStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cached = status
	s.cachedAt = time.Now()
}

// buildPublicStatus 把监测视图折成状态页。
// 只挑能对外的字段，Provider、模型名和配额快照一律不带过来。
func buildPublicStatus(views []*UserMonitorView, now time.Time) *PublicStatus {
	result := &PublicStatus{
		Status:     PublicStatusUnknown,
		UpdatedAt:  now,
		WindowDays: publicStatusWindowDays,
		Components: make([]PublicStatusComponent, 0, len(views)),
	}

	overall := PublicStatusUnknown
	availabilitySum := 0.0
	for _, view := range views {
		if view == nil {
			continue
		}
		component := PublicStatusComponent{
			Name:           view.Name,
			GroupName:      view.GroupName,
			Status:         monitorStatusToPublicLevel(view.PrimaryStatus),
			APIMode:        view.APIMode,
			Availability7d: view.Availability7d,
			LatencyMs:      view.PrimaryLatencyMs,
			PingLatencyMs:  view.PrimaryPingLatencyMs,
			Timeline:       make([]PublicStatusPoint, 0, len(view.Timeline)),
		}
		// 监测服务给的时间线是最新在前，状态条要按时间从左到右画，这里倒过来。
		for i := len(view.Timeline) - 1; i >= 0; i-- {
			point := view.Timeline[i]
			component.Timeline = append(component.Timeline, PublicStatusPoint{
				Status:    monitorStatusToPublicLevel(point.Status),
				CheckedAt: point.CheckedAt,
			})
		}
		result.Components = append(result.Components, component)
		overall = worseLevel(overall, component.Status)

		availabilitySum += component.Availability7d
		if component.Status == PublicStatusOperational {
			result.OperationalCount++
		}
	}

	result.Status = overall
	result.TotalCount = len(result.Components)
	if result.TotalCount > 0 {
		avg := availabilitySum / float64(result.TotalCount)
		result.Availability7d = float64(int64(avg*100+0.5)) / 100
	}
	return result
}

// monitorStatusToPublicLevel 把监测状态折成对外档位。
// failed 和 error 对访客是同一件事——用不了，合并成 outage。
func monitorStatusToPublicLevel(status string) PublicStatusLevel {
	switch status {
	case MonitorStatusOperational:
		return PublicStatusOperational
	case MonitorStatusDegraded:
		return PublicStatusDegraded
	case MonitorStatusFailed, MonitorStatusError:
		return PublicStatusOutage
	default:
		return PublicStatusUnknown
	}
}

// publicStatusSeverity 给状态排序，数值越大越糟。
// 未知排在正常之前，这样「有一项还没探测过」不会把整体拉成故障。
func publicStatusSeverity(level PublicStatusLevel) int {
	switch level {
	case PublicStatusOutage:
		return 3
	case PublicStatusDegraded:
		return 2
	case PublicStatusOperational:
		return 1
	default:
		return 0
	}
}

// worseLevel 取两者中更糟的一个。
func worseLevel(a, b PublicStatusLevel) PublicStatusLevel {
	if publicStatusSeverity(b) > publicStatusSeverity(a) {
		return b
	}
	return a
}
