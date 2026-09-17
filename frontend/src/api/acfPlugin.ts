import { apiClient } from './client'

// 组织防护只读插件页（ACF 数据代理）。数据形状与 ACF 侧
// /api/v1/plugin/* 的返回一一对应，字段名保持上游原样（snake_case）。

export interface ACFPluginWindow {
  from: string
  to: string
  bucket?: string
}

export interface ACFPluginSummary {
  window: ACFPluginWindow
  requests: number
  detections: number
  risks: number
  gapRequests: number
  byOutcome: Record<string, number>
  bySeverity: Record<string, number>
  codeLocKnown: boolean
}

export interface ACFPluginTrendPoint {
  ts: string
  events: number
  blocked: number
  redacted: number
  observed: number
}

export interface ACFPluginTrend {
  window: ACFPluginWindow
  timeline: ACFPluginTrendPoint[]
}

export interface ACFPluginRiskType {
  risk_type: string
  count: number
}

export interface ACFPluginTopActor {
  external_user_id: string
  user_name: string
  risks: number
}

export interface ACFPluginRecentEvent {
  id: string
  user_name: string
  external_user_id: string
  capability: string
  risk_type: string
  severity: string
  action: string
  masked_value: string
  created_at: string
}

export interface ACFPluginQuery {
  from?: string
  to?: string
  // 平台管理员指定要查看的组织；组织管理员不传（范围由会话锁定）。
  org_id?: number
}

function acfPluginParams(query: ACFPluginQuery) {
  const params: Record<string, string> = {}
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.org_id !== undefined) params.org_id = String(query.org_id)
  return { params }
}

export async function getACFPluginSummary(query: ACFPluginQuery = {}): Promise<ACFPluginSummary> {
  const { data } = await apiClient.get<ACFPluginSummary>('/acf-plugin/summary', acfPluginParams(query))
  return data
}

export async function getACFPluginTrend(query: ACFPluginQuery = {}): Promise<ACFPluginTrend> {
  const { data } = await apiClient.get<ACFPluginTrend>('/acf-plugin/trend', acfPluginParams(query))
  return data
}

export async function getACFPluginRiskTypes(query: ACFPluginQuery = {}): Promise<ACFPluginRiskType[]> {
  const { data } = await apiClient.get<{ types: ACFPluginRiskType[] }>('/acf-plugin/risk-types', acfPluginParams(query))
  return data.types ?? []
}

export async function getACFPluginTopActors(query: ACFPluginQuery = {}): Promise<ACFPluginTopActor[]> {
  const { data } = await apiClient.get<{ topActors: ACFPluginTopActor[] }>('/acf-plugin/top-actors', acfPluginParams(query))
  return data.topActors ?? []
}

export async function getACFPluginRecentEvents(query: ACFPluginQuery = {}): Promise<ACFPluginRecentEvent[]> {
  const { data } = await apiClient.get<{ events: ACFPluginRecentEvent[] }>('/acf-plugin/recent-events', acfPluginParams(query))
  return data.events ?? []
}
