import {
  isValidAmount,
  isValidPeriodDays,
  isValidRequestRange,
  memberNameError,
  noteTooLong,
  INVITATION_VALIDITY_DAYS,
  type InvitationValidity,
} from '@/lib/console/live/org-rules';
import type {
  DefaultQuotaInput,
  MemberBatch,
  MemberUpdate,
  MyOrgQuota,
  OrgDefaultQuota,
  OrgErrorReason,
  OrgInvitation,
  OrgMember,
  OrgMembersPage,
  OrgMembersQuery,
  OrgPeriodicQuota,
  OrgSummary,
  PeriodicQuotaInput,
  QuotaRequest,
  QuotaRequestAction,
  QuotaRequestPolicy,
  QuotaRequestsPage,
  QuotaRequestStatusFilter,
} from '@/lib/console/live/org-types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/lib/console/pagination';

import type { BackendError } from './envelope';

/**
 * 控制台组织页的后端接口：查询参数与请求体的校验、拼后端地址与请求体、把后端结果换成浏览器用的形状、
 * 错误归类。纯函数，单测锁住。后端接口都在 /api/v1/organization 下（只认登录身份，不收组织 ID），
 * 普通成员的组织配额在 /usage/dashboard/stats 的 organization_quota 里。
 */

export const ORG_PATH = '/organization';
export const INVITATIONS_PATH = '/organization/invitations';
export const MEMBERS_PATH = '/organization/members';
export const SPLIT_PATH = '/organization/members/spending-limit-split';
export const QUOTA_BATCH_PATH = '/organization/members/quota-batch';
export const DEFAULT_QUOTA_PATH = '/organization/default-quota';
export const POLICY_PATH = '/organization/quota-request-policy';
export const QUOTA_REQUESTS_PATH = '/organization/quota-requests';
export const DASHBOARD_STATS_PATH = '/usage/dashboard/stats';

export const invitationPath = (id: number) => `${INVITATIONS_PATH}/${id}`;
export const quotaRequestActionPath = (id: number, action: QuotaRequestAction) =>
  `${QUOTA_REQUESTS_PATH}/${id}/${action}`;

const SEARCH_MAX = 100;

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const positiveId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const list = (value: unknown): RawRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

/** 地址里的 ID：正整数，否则 null */
export function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && String(id) === value ? id : null;
}

function pageParams(params: URLSearchParams): { page: number; pageSize: number } | null {
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
  if (!Number.isSafeInteger(page) || page < 1 || !PAGE_SIZES.includes(pageSize)) return null;
  return { page, pageSize };
}

/* ---------- 读 ---------- */

/** 后端 GET /organization → 组织概况；不在组织里时后端给 null，这里也是 null */
export function toOrgSummary(raw: unknown): OrgSummary | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  if (id === null) return null;
  return {
    id,
    name: text(raw.name),
    isOwner: raw.is_owner === true,
    status: raw.status === 'disabled' ? 'disabled' : 'active',
    createdAt: text(raw.created_at),
  };
}

function toPeriodicQuota(raw: unknown): OrgPeriodicQuota | null {
  if (!isRecord(raw)) return null;
  const amount = num(raw.amount);
  const periodDays = num(raw.period_days);
  if (amount === null || periodDays === null) return null;
  return {
    mode: raw.mode === 'periodic_pending' ? 'periodic_pending' : 'periodic_active',
    amount,
    periodDays,
    startAt: text(raw.start_at),
    windowStart: textOrNull(raw.window_start),
    windowEnd: textOrNull(raw.window_end),
  };
}

export function toOrgMember(raw: unknown): OrgMember | null {
  if (!isRecord(raw)) return null;
  const userId = num(raw.user_id);
  if (userId === null) return null;
  return {
    userId,
    email: text(raw.email),
    username: text(raw.username),
    status: raw.status === 'disabled' ? 'disabled' : 'active',
    isOwner: raw.is_owner === true,
    displayName: text(raw.display_name),
    spendingLimit: num(raw.spending_limit),
    spendingUsed: num(raw.spending_used) ?? 0,
    spendingFrozen: num(raw.spending_frozen) ?? 0,
    spendingRemaining: num(raw.spending_remaining),
    quota: toPeriodicQuota(raw.quota),
    joinedAt: text(raw.joined_at),
  };
}

/** 后端分页结果 → 一页成员；看不懂时 null */
export function toMembersPage(raw: unknown): OrgMembersPage | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  return {
    items: raw.items.map(toOrgMember).filter((member): member is OrgMember => member !== null),
    total: num(raw.total) ?? 0,
    page: num(raw.page) ?? 1,
    pageSize: num(raw.page_size) ?? DEFAULT_PAGE_SIZE,
  };
}

/** 一批成员（批量操作的返回） */
export function toMembers(raw: unknown): OrgMember[] {
  return list(raw)
    .map(toOrgMember)
    .filter((member): member is OrgMember => member !== null);
}

export function toInvitation(raw: unknown): OrgInvitation | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  if (id === null || typeof raw.code !== 'string') return null;
  const status =
    raw.status === 'used' || raw.status === 'disabled' || raw.status === 'expired'
      ? raw.status
      : 'unused';
  return {
    id,
    code: raw.code,
    status,
    createdAt: text(raw.created_at),
    expiresAt: textOrNull(raw.expires_at),
    usedAt: textOrNull(raw.used_at),
  };
}

export function toInvitations(raw: unknown): OrgInvitation[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map(toInvitation).filter((item): item is OrgInvitation => item !== null);
}

export function toDefaultQuota(raw: unknown): OrgDefaultQuota | null {
  if (!isRecord(raw)) return null;
  return {
    enabled: raw.enabled === true,
    amount: num(raw.amount),
    periodDays: num(raw.period_days),
  };
}

/** 保存默认配额的结果：新的默认配额，以及顺带换新了几位成员 */
export function toDefaultQuotaResult(
  raw: unknown,
): { defaultQuota: OrgDefaultQuota; syncedUsers: number } | null {
  if (!isRecord(raw)) return null;
  const defaultQuota = toDefaultQuota(raw.quota);
  return defaultQuota ? { defaultQuota, syncedUsers: num(raw.synced_users) ?? 0 } : null;
}

export function toPolicy(raw: unknown): QuotaRequestPolicy | null {
  if (!isRecord(raw)) return null;
  const mode = raw.mode === 'approve' || raw.mode === 'auto' ? raw.mode : 'off';
  return { mode, minAmount: num(raw.min_amount), maxAmount: num(raw.max_amount) };
}

export function toQuotaRequest(raw: unknown): QuotaRequest | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  const amount = num(raw.amount);
  if (id === null || amount === null) return null;
  const status =
    raw.status === 'granted' || raw.status === 'rejected' || raw.status === 'withdrawn'
      ? raw.status
      : 'pending';
  return {
    id,
    userId: num(raw.user_id) ?? 0,
    email: text(raw.email),
    username: text(raw.username),
    displayName: text(raw.display_name),
    amount,
    reason: text(raw.reason),
    status,
    grantedAmount: num(raw.granted_amount),
    reviewNote: text(raw.review_note),
    reviewedAt: textOrNull(raw.reviewed_at),
    createdAt: text(raw.created_at),
  };
}

export function toQuotaRequestsPage(raw: unknown): QuotaRequestsPage | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  return {
    items: raw.items
      .map(toQuotaRequest)
      .filter((request): request is QuotaRequest => request !== null),
    total: num(raw.total) ?? 0,
    page: num(raw.page) ?? 1,
    pageSize: num(raw.page_size) ?? DEFAULT_PAGE_SIZE,
  };
}

/** 用户仪表盘统计 → 普通成员的组织配额；个人用户、组织管理员后端给 null */
export function toMyOrgQuota(stats: unknown): MyOrgQuota | null {
  if (!isRecord(stats) || !isRecord(stats.organization_quota)) return null;
  const raw = stats.organization_quota;
  const mode =
    raw.request_mode === 'approve' || raw.request_mode === 'auto' ? raw.request_mode : 'off';
  return {
    remaining: num(raw.remaining),
    windowEnd: textOrNull(raw.window_end),
    canRequest: raw.can_request === true,
    requestMode: mode,
    minAmount: num(raw.min_amount),
    maxAmount: num(raw.max_amount),
    pendingExists: raw.pending_exists === true,
  };
}

/* ---------- 查询参数 ---------- */

/** 成员列表：?page&pageSize&search&status */
export function parseMembersQuery(params: URLSearchParams): OrgMembersQuery | null {
  const paging = pageParams(params);
  if (!paging) return null;
  const search = (params.get('search') ?? '').trim();
  if (search.length > SEARCH_MAX) return null;
  const status = params.get('status') ?? 'all';
  if (status !== 'all' && status !== 'active' && status !== 'disabled') return null;
  return { ...paging, search, status };
}

export function membersListPath(query: OrgMembersQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  });
  if (query.search) params.set('search', query.search);
  if (query.status !== 'all') params.set('status', query.status);
  return `${MEMBERS_PATH}?${params.toString()}`;
}

/** 配额申请列表：?page&pageSize&status */
export function parseQuotaRequestsQuery(
  params: URLSearchParams,
): { page: number; pageSize: number; status: QuotaRequestStatusFilter } | null {
  const paging = pageParams(params);
  if (!paging) return null;
  const status = params.get('status') ?? 'all';
  if (
    status !== 'all' &&
    status !== 'pending' &&
    status !== 'granted' &&
    status !== 'rejected' &&
    status !== 'withdrawn'
  ) {
    return null;
  }
  return { ...paging, status };
}

export function quotaRequestsListPath(query: {
  page: number;
  pageSize: number;
  status: QuotaRequestStatusFilter;
}): string {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  });
  if (query.status !== 'all') params.set('status', query.status);
  return `${QUOTA_REQUESTS_PATH}?${params.toString()}`;
}

/* ---------- 请求体 ---------- */

function periodicQuota(value: unknown): PeriodicQuotaInput | null {
  if (!isRecord(value)) return null;
  const { amount, periodDays, startAt } = value;
  if (!isValidAmount(amount) || !isValidPeriodDays(periodDays)) return null;
  if (startAt !== null && (typeof startAt !== 'string' || Number.isNaN(Date.parse(startAt)))) {
    return null;
  }
  return { amount, periodDays, startAt };
}

const userIdList = (value: unknown): number[] | null =>
  Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every(positiveId)
    ? [...new Set(value)]
    : null;

/** 改一个成员：{ kind: 'status' | 'name' | 'limit' | 'quota', ... } */
export function parseMemberUpdate(body: RawRecord): MemberUpdate | null {
  switch (body.kind) {
    case 'status':
      return body.status === 'active' || body.status === 'disabled'
        ? { kind: 'status', status: body.status }
        : null;
    case 'name':
      return typeof body.displayName === 'string' && memberNameError(body.displayName) === null
        ? { kind: 'name', displayName: body.displayName.trim() }
        : null;
    case 'limit':
      return body.spendingLimit === null || isValidAmount(body.spendingLimit)
        ? { kind: 'limit', spendingLimit: body.spendingLimit }
        : null;
    case 'quota': {
      const quota = periodicQuota(body.quota);
      return quota ? { kind: 'quota', quota } : null;
    }
    default:
      return null;
  }
}

const quotaPayload = (quota: PeriodicQuotaInput) => ({
  amount: quota.amount,
  period_days: quota.periodDays,
  // 立即生效不带开始时间，后端取当前时刻
  ...(quota.startAt === null ? {} : { start_at: quota.startAt }),
});

/** 改一个成员 → 后端地址与请求体（PUT） */
export function memberUpdateRequest(
  userId: number,
  update: MemberUpdate,
): { path: string; body: RawRecord } {
  const base = `${MEMBERS_PATH}/${userId}`;
  switch (update.kind) {
    case 'status':
      return { path: `${base}/status`, body: { status: update.status } };
    case 'name':
      return { path: `${base}/display-name`, body: { display_name: update.displayName } };
    case 'limit':
      // 不限额、固定累计上限走同一个接口，后端会顺带清掉周期配额
      return { path: `${base}/spending-limit`, body: { spending_limit: update.spendingLimit } };
    case 'quota':
      return { path: `${base}/quota`, body: { quota: quotaPayload(update.quota) } };
  }
}

/** 批量：{ kind: 'split', userIds, totalAmount } 或 { kind: 'quota', userIds, quota } */
export function parseMemberBatch(body: RawRecord): MemberBatch | null {
  const userIds = userIdList(body.userIds);
  if (!userIds) return null;
  if (body.kind === 'split') {
    return isValidAmount(body.totalAmount)
      ? { kind: 'split', userIds, totalAmount: body.totalAmount }
      : null;
  }
  if (body.kind === 'quota') {
    const quota = periodicQuota(body.quota);
    return quota ? { kind: 'quota', userIds, quota } : null;
  }
  return null;
}

export function memberBatchRequest(batch: MemberBatch): { path: string; body: RawRecord } {
  return batch.kind === 'split'
    ? { path: SPLIT_PATH, body: { user_ids: batch.userIds, total_amount: batch.totalAmount } }
    : {
        path: QUOTA_BATCH_PATH,
        body: { user_ids: batch.userIds, quota: quotaPayload(batch.quota) },
      };
}

/** 新成员默认配额：开启时要有每期金额与周期天数 */
export function parseDefaultQuotaInput(body: RawRecord): DefaultQuotaInput | null {
  if (body.enabled === false) {
    return {
      enabled: false,
      amount: null,
      periodDays: null,
      syncUnconfigured: false,
      syncConfigured: false,
    };
  }
  if (body.enabled !== true || !isValidAmount(body.amount) || !isValidPeriodDays(body.periodDays)) {
    return null;
  }
  return {
    enabled: true,
    amount: body.amount,
    periodDays: body.periodDays,
    syncUnconfigured: body.syncUnconfigured === true,
    syncConfigured: body.syncConfigured === true,
  };
}

export function defaultQuotaPayload(input: DefaultQuotaInput): RawRecord {
  return input.enabled
    ? {
        enabled: true,
        amount: input.amount,
        period_days: input.periodDays,
        sync_unconfigured: input.syncUnconfigured,
        sync_configured: input.syncConfigured,
      }
    : { enabled: false, sync_unconfigured: false, sync_configured: false };
}

/** 申请策略：关闭时不要金额范围；不关闭时最低大于 0、最高不低于最低 */
export function parsePolicyInput(body: RawRecord): QuotaRequestPolicy | null {
  if (body.mode === 'off') return { mode: 'off', minAmount: null, maxAmount: null };
  if (body.mode !== 'approve' && body.mode !== 'auto') return null;
  const min = isValidAmount(body.minAmount) ? body.minAmount : null;
  const max = isValidAmount(body.maxAmount) ? body.maxAmount : null;
  if (!isValidRequestRange(min, max)) return null;
  return { mode: body.mode, minAmount: min, maxAmount: max };
}

export function policyPayload(policy: QuotaRequestPolicy): RawRecord {
  return { mode: policy.mode, min_amount: policy.minAmount, max_amount: policy.maxAmount };
}

/** 成员提交申请：{ amount, reason? } */
export function parseQuotaRequestSubmit(
  body: RawRecord,
): { amount: number; reason: string } | null {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!isValidAmount(body.amount) || body.amount <= 0 || noteTooLong(reason)) return null;
  return { amount: body.amount, reason };
}

/** 处理一条申请：{ action: 'approve' | 'reject' | 'withdraw', note? } */
export function parseQuotaRequestAction(
  body: RawRecord,
): { action: QuotaRequestAction; note: string } | null {
  const action = body.action;
  if (action !== 'approve' && action !== 'reject' && action !== 'withdraw') return null;
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (noteTooLong(note)) return null;
  return { action, note };
}

/** 处理申请 → 后端请求（POST）：通过、驳回要带 JSON（备注可以是空串，后端会读请求体）；撤回不带 */
export function quotaRequestActionRequest(
  id: number,
  action: QuotaRequestAction,
  note: string,
): { path: string; body: RawRecord | undefined } {
  return {
    path: quotaRequestActionPath(id, action),
    body: action === 'withdraw' ? undefined : { note },
  };
}

/** 创建邀请码：{ days }，到期时间按服务器的当前时间算 */
export function parseInvitationCreate(body: RawRecord): InvitationValidity | null {
  return INVITATION_VALIDITY_DAYS.find((days) => days === body.days) ?? null;
}

/* ---------- 错误 ---------- */

const REASONS: Record<string, OrgErrorReason> = {
  ORGANIZATION_OWNER_REQUIRED: 'owner_required',
  ORGANIZATION_NOT_FOUND: 'not_in_org',
  ORGANIZATION_MEMBERSHIP_NOT_FOUND: 'not_in_org',
  ORGANIZATION_DISABLED: 'org_disabled',
  ORGANIZATION_MEMBER_NOT_FOUND: 'member_not_found',
  ORGANIZATION_MEMBER_OWNER_IMMUTABLE: 'owner_immutable',
  ORGANIZATION_MEMBER_PLATFORM_ADMIN: 'owner_immutable',
  ORGANIZATION_MEMBER_NAME_INVALID: 'name_invalid',
  ORGANIZATION_SPENDING_LIMIT_INVALID: 'amount_invalid',
  ORGANIZATION_QUOTA_AMOUNT_INVALID: 'amount_invalid',
  ORGANIZATION_QUOTA_PERIOD_INVALID: 'period_invalid',
  ORGANIZATION_QUOTA_START_INVALID: 'start_invalid',
  ORGANIZATION_SPENDING_SPLIT_TARGETS: 'no_targets',
  ORGANIZATION_QUOTA_TARGETS: 'no_targets',
  ORGANIZATION_QUOTA_REQUEST_DISABLED: 'request_disabled',
  ORGANIZATION_QUOTA_REQUEST_AMOUNT_INVALID: 'request_amount',
  ORGANIZATION_QUOTA_REQUEST_PENDING_EXISTS: 'request_pending_exists',
  ORGANIZATION_QUOTA_REQUEST_MEMBER_INELIGIBLE: 'request_ineligible',
  ORGANIZATION_QUOTA_REQUEST_NOT_PENDING: 'request_handled',
  ORGANIZATION_QUOTA_REQUEST_NOT_FOUND: 'request_not_found',
  ORGANIZATION_QUOTA_REQUEST_REASON_TOO_LONG: 'text_too_long',
  ORGANIZATION_QUOTA_REQUEST_NOTE_TOO_LONG: 'text_too_long',
  ORGANIZATION_QUOTA_REQUEST_RANGE_INVALID: 'range_invalid',
  ORGANIZATION_QUOTA_REQUEST_MODE_INVALID: 'range_invalid',
};

/** 后端错误 → 页面上的失败原因 */
export function orgErrorFor(error: BackendError): OrgErrorReason {
  const known = REASONS[error.reason];
  if (known) return known;
  if (error.status === 403) return 'forbidden';
  if (error.status === 429) return 'too_many';
  if (error.status >= 500) return 'unavailable';
  return 'invalid';
}

/** 失败原因对应回给浏览器的状态码 */
export function orgErrorStatus(reason: OrgErrorReason): number {
  switch (reason) {
    case 'owner_required':
    case 'org_disabled':
    case 'forbidden':
      return 403;
    case 'not_in_org':
    case 'member_not_found':
    case 'request_not_found':
      return 404;
    case 'request_pending_exists':
    case 'request_handled':
      return 409;
    case 'too_many':
      return 429;
    case 'unavailable':
      return 503;
    default:
      return 400;
  }
}
