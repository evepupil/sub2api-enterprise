import type { DateRange, TrendGranularity, UsageOverview, UsageRecord } from '../usage/types';
export interface MemberUsageRow {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  requests: number;
  tokens: number;
  standardCost: number;
  actualCost: number;
}
export interface OrganizationUsageFilters {
  range: DateRange;
  memberId?: number;
  granularity: TrendGranularity;
}
export interface OrganizationUsageOverview {
  overview: UsageOverview;
  members: MemberUsageRow[];
}
export interface OrganizationUsageRecord extends UsageRecord {
  userId: number;
  userLabel: string;
}
export interface OrganizationUsageRecordFilters {
  range: DateRange;
  memberId?: number;
  page: number;
  pageSize: number;
  model?: string;
}
