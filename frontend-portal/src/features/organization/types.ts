export interface OrganizationInfo {
  id: number;
  name: string;
  isOwner: boolean;
  status: string;
  createdAt: string | null;
}

export type MemberStatus = 'active' | 'disabled' | 'unknown';
export interface RecurringQuota {
  mode: 'periodic_pending' | 'periodic_active';
  amount: number;
  periodDays: number;
  startAt: string;
  windowStart: string | null;
  windowEnd: string | null;
}
export interface OrganizationMember {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  status: MemberStatus;
  isOwner: boolean;
  limit: number | null;
  used: number | null;
  frozen: number | null;
  remaining: number | null;
  quota: RecurringQuota | null;
  joinedAt: string;
}
export interface MemberFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'active' | 'disabled';
}
export interface OrganizationInvitation {
  id: number;
  code: string;
  status: 'unused' | 'used' | 'disabled' | 'unknown';
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
}
export interface QuotaDraft {
  mode: 'static' | 'periodic';
  unlimited: boolean;
  amount: string;
  periodDays: string;
  starts: 'now' | 'date';
  startDate: string;
}
export interface DefaultQuota {
  enabled: boolean;
  amount: number | null;
  periodDays: number | null;
}
export interface DefaultQuotaDraft {
  enabled: boolean;
  amount: string;
  periodDays: string;
  syncUnconfigured: boolean;
  syncConfigured: boolean;
}
export interface DefaultQuotaResult {
  quota: DefaultQuota;
  syncedUsers: number;
}
export type QuotaRequestMode = 'off' | 'approve' | 'auto';
export interface QuotaRequestPolicy {
  mode: QuotaRequestMode;
  minAmount: number | null;
  maxAmount: number | null;
}
export interface PolicyDraft {
  mode: QuotaRequestMode;
  minAmount: string;
  maxAmount: string;
}
export type QuotaRequestStatus = 'pending' | 'granted' | 'rejected' | 'withdrawn' | 'unknown';
export interface QuotaRequestRecord {
  id: number;
  userId: number;
  email: string;
  username: string;
  displayName: string;
  amount: number;
  reason: string;
  status: QuotaRequestStatus;
  grantSource: 'manual' | 'auto' | null;
  grantedAmount: number | null;
  snapshotMode: string;
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
}
export interface RequestFilters {
  page: number;
  pageSize: number;
  status?: Exclude<QuotaRequestStatus, 'unknown'>;
}
export interface MemberQuotaInfo {
  remaining: number | null;
  windowEnd: string | null;
  canRequest: boolean;
  requestMode: QuotaRequestMode;
  minAmount: number | null;
  maxAmount: number | null;
  pendingExists: boolean;
}
