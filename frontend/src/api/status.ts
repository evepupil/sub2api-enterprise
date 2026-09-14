import { apiClient } from './client'

/**
 * 对外服务状态（公开端点，匿名可访问）。
 *
 * 数据来自管理员在后台配置的渠道监测，状态、延迟、可用率和时间线都是监测
 * 服务算好的，这里只是取回来展示。后端不返回上游厂商、模型名和配额快照。
 * 平台开关关闭时返回 404，前端据此隐藏入口。
 */

/** 状态档位。监测的 failed / error 在后端已合并成 outage。 */
export type ServiceStatusLevel = 'operational' | 'degraded' | 'outage' | 'unknown'

export interface ServiceStatusPoint {
  status: ServiceStatusLevel
  checked_at: string
}

export interface ServiceStatusComponent {
  /** 监测项名称，由管理员在后台命名 */
  name: string
  /** 所属分组，未设置时为空 */
  group_name?: string
  status: ServiceStatusLevel
  /** 探测走的接口形态（chat_completions / responses） */
  api_mode?: string
  /** 近 7 天可用率，0-100 */
  availability_7d: number
  /** 最近一次探测的响应耗时，含上游生成时间；未取到为 null */
  latency_ms: number | null
  /** 最近一次探测的网络往返耗时；未取到为 null */
  ping_latency_ms: number | null
  /** 最近若干次探测，按时间从早到晚 */
  timeline: ServiceStatusPoint[]
}

export interface ServiceStatus {
  status: ServiceStatusLevel
  updated_at: string
  window_days: number
  /** 所有监测项可用率的算术平均 */
  availability_7d: number
  /** 状态正常的监测项数 */
  operational_count: number
  /** 监测项总数 */
  total_count: number
  components: ServiceStatusComponent[]
}

export async function getServiceStatus(options?: { signal?: AbortSignal }): Promise<ServiceStatus> {
  const { data } = await apiClient.get<ServiceStatus>('/status', { signal: options?.signal })
  return data
}

export default { getServiceStatus }
