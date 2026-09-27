/**
 * M4 独立配额申请业务规则测试。
 *
 * 契约来源：.fleet/briefs/m45-quota-requests-api.md、src/features/organization/types.ts、
 * design/team-and-delivery.md「成员申请弹窗」。
 * 只覆盖纯校验/适配/请求边界，请求全部用 mock，不发真实网络请求。
 *
 * 业务事实（任务书）：
 * - policy off 时 min/max 为 null；approve/auto 必须是正数且 max>=min。
 * - 申请金额正数最多 8 位；理由/审批备注 trim 后最长 500 Unicode 码点。
 * - 未知 status 不能审批、不能撤回；撤回还要求申请属于当前 userID。
 * - memberQuota 字段缺失必须报错，只有显式 null 的 remaining 才表示不限。
 * - can_request=false / pending_exists=true 阻止提交。
 * - grant_source 与 status 以服务端返回值为准，auto 也不在本地假增余额。
 * - 请求体不带多余成员 id / 组织 id，所有数字字段不是字符串；写操作不自动重试。
 * - 成员本人只读 /usage/dashboard/stats 的 organization_quota，不得 GET owner 专属 policy。
 */

import { describe, expect, it } from 'vitest';

import type { ApiRequestOptions, ApiRequester } from '../src/features/auth/types';
import {
  parseMemberQuota,
  parseQuotaRequest,
  parseQuotaRequestPage,
  parseRequestPolicy,
} from '../src/features/organization/request-adapter';
import {
  fetchMemberQuota,
  fetchQuotaRequests,
  fetchRequestPolicy,
  reviewQuotaRequest,
  saveRequestPolicy,
  submitQuotaRequest,
  withdrawQuotaRequest,
} from '../src/features/organization/request-api';
import type {
  MemberQuotaInfo,
  PolicyDraft,
  QuotaRequestRecord,
} from '../src/features/organization/types';
import {
  buildPolicyPayload,
  buildQuotaRequestPayload,
  canReviewRequest,
  canWithdrawRequest,
  reviewNote,
} from '../src/features/organization/request-validation';

interface Call {
  path: string;
  options?: ApiRequestOptions;
}

function makeRequester(
  handler: (path: string, options?: ApiRequestOptions) => unknown = () => ({}),
): { request: ApiRequester; calls: Call[] } {
  const calls: Call[] = [];
  const request = ((path: string, options?: ApiRequestOptions) => {
    calls.push({ path, options });
    return Promise.resolve(handler(path, options));
  }) as unknown as ApiRequester;
  return { request, calls };
}

function firstCall(calls: Call[]): Call {
  const call = calls[0];
  if (!call) {
    throw new Error('requester 未被调用');
  }
  return call;
}

/** 后端 /organization/quota-requests 记录的最小合法形态，测试按需覆盖字段。 */
function requestRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11,
    user_id: 7,
    email: 'member@example.com',
    username: 'member',
    display_name: '成员',
    amount: 100,
    reason: '需要更多额度',
    status: 'pending',
    grant_source: null,
    granted_amount: null,
    snapshot_mode: 'static',
    review_note: '',
    reviewed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function record(overrides: Partial<QuotaRequestRecord> = {}): QuotaRequestRecord {
  return {
    id: 11,
    userId: 7,
    email: 'member@example.com',
    username: 'member',
    displayName: '成员',
    amount: 100,
    reason: '需要更多额度',
    status: 'pending',
    grantSource: null,
    grantedAmount: null,
    snapshotMode: 'static',
    reviewNote: '',
    reviewedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function policyDraft(overrides: Partial<PolicyDraft> = {}): PolicyDraft {
  return { mode: 'approve', minAmount: '10', maxAmount: '100', ...overrides };
}

function quotaInfo(overrides: Partial<MemberQuotaInfo> = {}): MemberQuotaInfo {
  return {
    remaining: 50,
    windowEnd: null,
    canRequest: true,
    requestMode: 'approve',
    minAmount: 10,
    maxAmount: 100,
    pendingExists: false,
    ...overrides,
  };
}

describe('buildPolicyPayload：off 清空、approve/auto 正数区间', () => {
  it('off 提交 min/max 为 null，且不猜 0', () => {
    const payload = buildPolicyPayload({ mode: 'off', minAmount: '', maxAmount: '' });
    expect(payload.mode).toBe('off');
    expect(payload.min_amount).toBeNull();
    expect(payload.max_amount).toBeNull();
  });

  it('approve 提交正数区间', () => {
    const payload = buildPolicyPayload(policyDraft());
    expect(payload.mode).toBe('approve');
    expect(payload.min_amount).toBe(10);
    expect(payload.max_amount).toBe(100);
  });

  it('auto 同样需要正数区间', () => {
    const payload = buildPolicyPayload(policyDraft({ mode: 'auto' }));
    expect(payload.mode).toBe('auto');
    expect(payload.min_amount).toBe(10);
  });

  it('min/max 为空、0、负数或小数超 8 位时拒绝', () => {
    expect(() => buildPolicyPayload(policyDraft({ minAmount: '' }))).toThrow();
    expect(() => buildPolicyPayload(policyDraft({ minAmount: '0' }))).toThrow();
    expect(() => buildPolicyPayload(policyDraft({ maxAmount: '-1' }))).toThrow();
    expect(() => buildPolicyPayload(policyDraft({ minAmount: '1.123456789' }))).toThrow();
  });

  it('max < min 时拒绝', () => {
    expect(() => buildPolicyPayload(policyDraft({ minAmount: '100', maxAmount: '10' }))).toThrow();
  });
});

describe('buildQuotaRequestPayload：正数、8 位、理由 500 码点', () => {
  it('正常金额转数字，理由 trim', () => {
    const payload = buildQuotaRequestPayload({ amount: '12.5', reason: '  需要额度  ' });
    expect(payload.amount).toBe(12.5);
    expect(payload.reason).toBe('需要额度');
  });

  it('金额必须为正数且最多 8 位小数', () => {
    expect(() => buildQuotaRequestPayload({ amount: '0', reason: 'x' })).toThrow();
    expect(() => buildQuotaRequestPayload({ amount: '-1', reason: 'x' })).toThrow();
    expect(() => buildQuotaRequestPayload({ amount: '', reason: 'x' })).toThrow();
    expect(() => buildQuotaRequestPayload({ amount: '1e3', reason: 'x' })).toThrow();
    expect(() => buildQuotaRequestPayload({ amount: '1.123456789', reason: 'x' })).toThrow();
    expect(buildQuotaRequestPayload({ amount: '0.12345678', reason: 'x' }).amount).toBe(0.12345678);
  });

  it('理由超过 500 个 Unicode 码点被拒绝', () => {
    expect(buildQuotaRequestPayload({ amount: '1', reason: 'a'.repeat(500) }).reason).toHaveLength(
      500,
    );
    expect(() => buildQuotaRequestPayload({ amount: '1', reason: 'a'.repeat(501) })).toThrow();
    expect(() => buildQuotaRequestPayload({ amount: '1', reason: '😀'.repeat(501) })).toThrow();
  });

  it('can_request=false 时阻止提交', () => {
    expect(() =>
      buildQuotaRequestPayload({ amount: '10', reason: 'x' }, quotaInfo({ canRequest: false })),
    ).toThrow();
  });

  it('pending_exists=true 时阻止重复提交', () => {
    expect(() =>
      buildQuotaRequestPayload({ amount: '10', reason: 'x' }, quotaInfo({ pendingExists: true })),
    ).toThrow();
  });

  it('超出 min/max 区间时拒绝', () => {
    expect(() => buildQuotaRequestPayload({ amount: '5', reason: 'x' }, quotaInfo())).toThrow();
    expect(() => buildQuotaRequestPayload({ amount: '200', reason: 'x' }, quotaInfo())).toThrow();
    expect(buildQuotaRequestPayload({ amount: '50', reason: 'x' }, quotaInfo()).amount).toBe(50);
  });
});

describe('reviewNote：trim 后最长 500 码点', () => {
  it('trim 并保留空备注', () => {
    expect(reviewNote('  同意  ')).toBe('同意');
    expect(reviewNote('   ')).toBe('');
  });

  it('超过 500 码点拒绝', () => {
    expect(reviewNote('a'.repeat(500))).toHaveLength(500);
    expect(() => reviewNote('a'.repeat(501))).toThrow();
    expect(() => reviewNote('😀'.repeat(501))).toThrow();
  });
});

describe('canReviewRequest / canWithdrawRequest：状态与归属', () => {
  it('只有 pending 可审批', () => {
    expect(canReviewRequest(record({ status: 'pending' }))).toBe(true);
    expect(canReviewRequest(record({ status: 'granted' }))).toBe(false);
    expect(canReviewRequest(record({ status: 'rejected' }))).toBe(false);
    expect(canReviewRequest(record({ status: 'withdrawn' }))).toBe(false);
    expect(canReviewRequest(record({ status: 'unknown' }))).toBe(false);
  });

  it('撤回必须 pending 且属于本人', () => {
    expect(canWithdrawRequest(record({ status: 'pending', userId: 7 }), 7)).toBe(true);
    expect(canWithdrawRequest(record({ status: 'pending', userId: 7 }), 8)).toBe(false);
    expect(canWithdrawRequest(record({ status: 'granted', userId: 7 }), 7)).toBe(false);
    expect(canWithdrawRequest(record({ status: 'unknown', userId: 7 }), 7)).toBe(false);
  });
});

describe('adapter：policy 与 request 的 null/未知语义', () => {
  it('off 策略归一成 min/max null', () => {
    expect(parseRequestPolicy({ mode: 'off', min_amount: 5, max_amount: 10 })).toEqual({
      mode: 'off',
      minAmount: null,
      maxAmount: null,
    });
  });

  it('approve/auto 缺 min 或 max 报错，不猜不限', () => {
    expect(() => parseRequestPolicy({ mode: 'approve', min_amount: 5 })).toThrow();
    expect(() => parseRequestPolicy({ mode: 'approve', max_amount: 5 })).toThrow();
    expect(() => parseRequestPolicy({ mode: 'auto', min_amount: 0, max_amount: 10 })).toThrow();
    expect(() => parseRequestPolicy({ mode: 'approve', min_amount: 10, max_amount: 5 })).toThrow();
  });

  it('未知 status 归 unknown，不套 pending', () => {
    expect(parseQuotaRequest(requestRecord({ status: 'approved' })).status).toBe('unknown');
    expect(parseQuotaRequest(requestRecord({ status: 'pending' })).status).toBe('pending');
  });

  it('grant_source 只认 manual/auto，其它归 null', () => {
    expect(parseQuotaRequest(requestRecord({ grant_source: 'auto' })).grantSource).toBe('auto');
    expect(parseQuotaRequest(requestRecord({ grant_source: 'manual' })).grantSource).toBe('manual');
    expect(parseQuotaRequest(requestRecord({ grant_source: 'system' })).grantSource).toBeNull();
  });

  it('granted_amount 显式 null 与数字都保留', () => {
    expect(parseQuotaRequest(requestRecord({ granted_amount: null })).grantedAmount).toBeNull();
    expect(parseQuotaRequest(requestRecord({ granted_amount: 80 })).grantedAmount).toBe(80);
  });

  it('reviewed_at 可选：缺失/undefined 与显式 null 都归一成 null，不混淆 granted_amount', () => {
    const withoutReviewedAt = requestRecord();
    delete withoutReviewedAt.reviewed_at;
    expect(parseQuotaRequest(withoutReviewedAt).reviewedAt).toBeNull();
    expect(parseQuotaRequest(requestRecord({ reviewed_at: undefined })).reviewedAt).toBeNull();
    expect(parseQuotaRequest(requestRecord({ reviewed_at: null })).reviewedAt).toBeNull();
    // 未发放的 pending 记录可以没有 granted_amount，但 reviewed_at 与 granted_amount
    // 是两个独立语义：一个缺失不能把另一个的值顶替过去。
    const pending = parseQuotaRequest(requestRecord({ reviewed_at: null, granted_amount: null }));
    expect(pending.reviewedAt).toBeNull();
    expect(pending.grantedAmount).toBeNull();
    const reviewed = parseQuotaRequest(
      requestRecord({ status: 'granted', reviewed_at: '2026-02-01T00:00:00Z', granted_amount: 60 }),
    );
    expect(reviewed.reviewedAt).toBe('2026-02-01T00:00:00Z');
    expect(reviewed.grantedAmount).toBe(60);
  });

  it('私有字段不透传', () => {
    const parsed = parseQuotaRequest(
      requestRecord({ snapshot_limit: 1, reviewer_user_id: 9, password: 'x' }),
    );
    expect(parsed).not.toHaveProperty('snapshotLimit');
    expect(parsed).not.toHaveProperty('reviewerUserId');
    expect(parsed).not.toHaveProperty('password');
  });

  it('parseQuotaRequestPage：pages 缺失按 ceil(total/page_size)', () => {
    const page = parseQuotaRequestPage({
      items: [requestRecord()],
      total: 41,
      page: 1,
      page_size: 20,
    });
    expect(page.pages).toBe(3);
  });

  it('parseMemberQuota：remaining 显式 null 表示不限', () => {
    const parsed = parseMemberQuota({
      organization_quota: {
        remaining: null,
        window_end: null,
        can_request: true,
        request_mode: 'auto',
        min_amount: null,
        max_amount: null,
        pending_exists: false,
      },
    });
    expect(parsed.remaining).toBeNull();
    expect(parsed.canRequest).toBe(true);
    expect(parsed.pendingExists).toBe(false);
  });

  it('parseMemberQuota：字段缺失报错，缺失不等于 false / 不限', () => {
    const base = {
      remaining: 10,
      window_end: null,
      can_request: true,
      request_mode: 'approve',
      min_amount: 1,
      max_amount: 10,
      pending_exists: false,
    };
    const missing = (key: string) => {
      const copy: Record<string, unknown> = { ...base };
      delete copy[key];
      return copy;
    };
    expect(() => parseMemberQuota({ organization_quota: missing('remaining') })).toThrow();
    expect(() => parseMemberQuota({ organization_quota: missing('can_request') })).toThrow();
    expect(() => parseMemberQuota({ organization_quota: missing('pending_exists') })).toThrow();
    expect(() => parseMemberQuota({ organization_quota: missing('request_mode') })).toThrow();
  });

  it('parseMemberQuota：min_amount/max_amount/window_end 缺失或 undefined 拒绝，显式 null 可以', () => {
    const base = {
      remaining: 10,
      window_end: null,
      can_request: true,
      request_mode: 'approve',
      min_amount: 1,
      max_amount: 10,
      pending_exists: false,
    };
    const missing = (key: string) => {
      const copy: Record<string, unknown> = { ...base };
      delete copy[key];
      return copy;
    };
    // 后端 DTO 的 min_amount / max_amount / window_end 无 omitempty，字段必须存在；
    // 缺失或 undefined 说明响应结构异常，不能猜成 null（null 才代表不限/无重置）。
    expect(() => parseMemberQuota({ organization_quota: missing('min_amount') })).toThrow();
    expect(() => parseMemberQuota({ organization_quota: missing('max_amount') })).toThrow();
    expect(() => parseMemberQuota({ organization_quota: missing('window_end') })).toThrow();
    expect(() =>
      parseMemberQuota({ organization_quota: { ...base, min_amount: undefined } }),
    ).toThrow();
    expect(() =>
      parseMemberQuota({ organization_quota: { ...base, max_amount: undefined } }),
    ).toThrow();
    expect(() =>
      parseMemberQuota({ organization_quota: { ...base, window_end: undefined } }),
    ).toThrow();

    // 显式 null 是合法业务值：min/max 不限、window_end 无重置。
    const parsed = parseMemberQuota({
      organization_quota: { ...base, min_amount: null, max_amount: null, window_end: null },
    });
    expect(parsed.minAmount).toBeNull();
    expect(parsed.maxAmount).toBeNull();
    expect(parsed.windowEnd).toBeNull();
  });

  it('parseMemberQuota：organization_quota 缺失或 null 报错', () => {
    expect(() => parseMemberQuota({})).toThrow();
    expect(() => parseMemberQuota({ organization_quota: null })).toThrow();
  });
});

describe('API：path/方法/body 对应本人组织', () => {
  it('fetchRequestPolicy GET /organization/quota-request-policy', async () => {
    const { request, calls } = makeRequester(() => ({
      mode: 'off',
      min_amount: null,
      max_amount: null,
    }));
    await fetchRequestPolicy(request);
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/quota-request-policy');
    expect(call.options?.method).toBe('GET');
  });

  it('saveRequestPolicy PUT 同 path，body 数字不是字符串', async () => {
    const { request, calls } = makeRequester(() => ({
      mode: 'approve',
      min_amount: 10,
      max_amount: 100,
    }));
    await saveRequestPolicy(request, policyDraft());
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/quota-request-policy');
    expect(call.options?.method).toBe('PUT');
    const body = call.options?.body as Record<string, unknown>;
    expect(typeof body.min_amount).toBe('number');
    expect(typeof body.max_amount).toBe('number');
  });

  it('fetchQuotaRequests GET 带分页参数', async () => {
    const { request, calls } = makeRequester(() => ({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    }));
    await fetchQuotaRequests(request, { page: 1, pageSize: 20, status: 'pending' });
    const call = firstCall(calls);
    expect(call.path).toContain('/organization/quota-requests?');
    expect(call.path).toContain('page=1');
    expect(call.path).toContain('status=pending');
  });

  it('submitQuotaRequest POST，body 只有 amount 与 reason，数字不字符串', async () => {
    const { request, calls } = makeRequester(() => requestRecord());
    await submitQuotaRequest(request, { amount: '12.5', reason: '需要' });
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/quota-requests');
    expect(call.options?.method).toBe('POST');
    const body = call.options?.body as Record<string, unknown>;
    expect(body.amount).toBe(12.5);
    expect(typeof body.amount).toBe('number');
    expect(body.reason).toBe('需要');
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('organization_id');
  });

  it('withdrawQuotaRequest POST /id/withdraw，非正 id 拒绝', async () => {
    const { request, calls } = makeRequester(() => requestRecord({ status: 'withdrawn' }));
    await withdrawQuotaRequest(request, 11);
    expect(firstCall(calls).path).toBe('/organization/quota-requests/11/withdraw');
    await expect(withdrawQuotaRequest(request, 0)).rejects.toThrow();
    await expect(withdrawQuotaRequest(request, -1)).rejects.toThrow();
  });

  it('reviewQuotaRequest approve/reject POST /id/action，body 带 note', async () => {
    const { request, calls } = makeRequester(() => requestRecord({ status: 'granted' }));
    await reviewQuotaRequest(request, 11, 'approve', '同意');
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/quota-requests/11/approve');
    expect(call.options?.method).toBe('POST');
    expect(call.options?.body).toEqual({ note: '同意' });
  });

  it('reviewQuotaRequest 非法 action 拒绝', async () => {
    const { request, calls } = makeRequester(() => requestRecord());
    await expect(
      reviewQuotaRequest(request, 11, 'delete' as unknown as 'approve', 'x'),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('fetchMemberQuota GET /usage/dashboard/stats，不请求 owner policy', async () => {
    const { request, calls } = makeRequester(() => ({
      organization_quota: {
        remaining: null,
        window_end: null,
        can_request: true,
        request_mode: 'off',
        min_amount: null,
        max_amount: null,
        pending_exists: false,
      },
    }));
    const info = await fetchMemberQuota(request);
    expect(info.remaining).toBeNull();
    expect(calls).toHaveLength(1);
    expect(firstCall(calls).path).toBe('/usage/dashboard/stats');
    expect(firstCall(calls).path).not.toContain('quota-request-policy');
  });

  it('写操作失败不自动重试', async () => {
    let attempts = 0;
    const request = (() => {
      attempts += 1;
      return Promise.reject(new Error('boom'));
    }) as unknown as ApiRequester;
    await expect(submitQuotaRequest(request, { amount: '10', reason: 'x' })).rejects.toThrow();
    expect(attempts).toBe(1);
  });
});
