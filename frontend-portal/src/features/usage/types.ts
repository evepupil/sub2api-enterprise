export interface DateRange {
  start: string;
  end: string;
  timeZone: string;
}
export type DatePreset =
  'today' | 'yesterday' | 'last7' | 'last14' | 'last30' | 'thisWeek' | 'thisMonth' | 'lastMonth';
export type TrendGranularity = 'day' | 'hour';
export interface TokenTotals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  total: number;
}
export interface UsageSummary {
  requests: number;
  tokens: TokenTotals;
  actualCost: number;
  standardCost: number;
  averageDurationMs: number;
}
export interface BreakdownRow {
  id: string;
  label: string;
  requests: number;
  tokens: number;
  cost: number;
}
export interface UsageTrendPoint {
  date: string;
  requests: number;
  tokens: TokenTotals;
  actualCost: number;
}
export interface UsageOverview {
  summary: UsageSummary;
  models: BreakdownRow[];
  groups: BreakdownRow[];
  endpoints: BreakdownRow[];
  trend: UsageTrendPoint[];
}
export interface UsageRecord {
  id: number;
  createdAt: string;
  model: string;
  keyName: string;
  keyId: number;
  tokens: TokenTotals;
  actualCost: number;
  standardCost: number;
  durationMs: number | null;
  stream: boolean;
}
export interface UsageFilters {
  range: DateRange;
  page: number;
  pageSize: number;
  model?: string;
  keyId?: number;
}
export type CurrentFunds =
  | { kind: 'balance'; amount: number; frozen: number }
  | { kind: 'quota'; amount: number | null; windowEnd: string | null };
