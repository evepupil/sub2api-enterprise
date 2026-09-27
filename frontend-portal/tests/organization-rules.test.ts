/**
 * M4 独立组织/成员/额度业务规则测试。
 *
 * 契约来源：.fleet/briefs/m45-organization-api.md、src/features/organization/types.ts、
 * design/team-and-delivery.md 页面 14。
 * 只覆盖纯校验/适配/请求边界，请求全部用 mock，不发真实网络请求。
 *
 * 业务事实（任务书）：
 * - owner 的金额字段可能全 null；普通成员 limit:null 表示不限、0 表示禁止消费，0 不能变 null。
 * - 周期 amount/period_days/start_at/window_* 的 null 语义；未返回额度字段不能猜成不限。
 * - 邀请状态 unused/used/disabled 与到期派生 expired，按真实 now 判断。
 * - 显示名 Unicode 码点 1..50；金额非负最多 8 位，空/NaN/指数/负拒绝，0 保留。
 * - 周期 1..3650 整数；立即生效省略 start_at；未来日历日期按本地 0 点转 ISO，拒绝 2026-02-30。
 * - static unlimited 明确 null，static 0 保持 0；批量只周期，不冒充静态。
 * - 默认配额 disabled 清额并同步 false，enabled 0 有效，sync 不开不碰现有成员。
 * - 方法/path/body 只对应本人组织，id 不能注入非正数，写操作不自动重试。
 * - fetchAllMemberOptions 超过 200 继续分页，不静默截断；中途失败不能当成功残缺列表。
 */

import { describe, expect, it } from 'vitest';

import type { ApiRequestOptions, ApiRequester } from '../src/features/auth/types';
import {
  parseDefaultQuota,
  parseDefaultQuotaResult,
  parseInvitations,
  parseMember,
  parseMemberPage,
  parseOrganization,
} from '../src/features/organization/adapter';
import {
  createInvitation,
  disableInvitation,
  fetchAllMemberOptions,
  fetchDefaultQuota,
  fetchInvitations,
  fetchMembers,
  fetchOrganization,
  saveBatchQuota,
  saveDefaultQuota,
  saveMemberQuota,
  setMemberStatus,
  splitMemberLimits,
  updateMemberName,
} from '../src/features/organization/api';
import type { OrganizationMember, QuotaDraft } from '../src/features/organization/types';
import {
  buildDefaultQuotaPayload,
  buildMemberQuotaPayload,
  createQuotaDraft,
  invitationStatus,
  memberLabel,
  parseQuotaAmount,
  validateDisplayName,
} from '../src/features/organization/validation';

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

/** 后端 /organization/members 记录的最小合法形态，测试按需覆盖字段。 */
function memberRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: 7,
    email: 'member@example.com',
    username: 'member',
    display_name: '成员',
    status: 'active',
    is_owner: false,
    spending_limit: 100,
    spending_used: 20,
    spending_frozen: 0,
    spending_remaining: 80,
    quota: null,
    joined_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function member(overrides: Partial<OrganizationMember> = {}): OrganizationMember {
  return {
    userId: 7,
    email: 'member@example.com',
    username: 'member',
    displayName: '成员',
    status: 'active',
    isOwner: false,
    limit: 100,
    used: 20,
    frozen: 0,
    remaining: 80,
    quota: null,
    joinedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function staticDraft(overrides: Partial<QuotaDraft> = {}): QuotaDraft {
  return {
    mode: 'static',
    unlimited: false,
    amount: '100',
    periodDays: '',
    starts: 'now',
    startDate: '',
    ...overrides,
  };
}

describe('parseQuotaAmount：非负、最多 8 位、0 保留', () => {
  it('正常十进制原样转数字，0 保留为 0', () => {
    expect(parseQuotaAmount('0')).toBe(0);
    expect(parseQuotaAmount('12')).toBe(12);
    expect(parseQuotaAmount('12.5')).toBe(12.5);
    expect(parseQuotaAmount('0.12345678')).toBe(0.12345678);
  });

  it('前后空白会被 trim', () => {
    expect(parseQuotaAmount('  8  ')).toBe(8);
  });

  it('空字符串不猜成 0', () => {
    expect(() => parseQuotaAmount('')).toThrow();
    expect(() => parseQuotaAmount('   ')).toThrow();
  });

  it('负数、NaN 文本、指数与符号都被拒绝', () => {
    expect(() => parseQuotaAmount('-1')).toThrow();
    expect(() => parseQuotaAmount('-0.5')).toThrow();
    expect(() => parseQuotaAmount('NaN')).toThrow();
    expect(() => parseQuotaAmount('Infinity')).toThrow();
    expect(() => parseQuotaAmount('1e3')).toThrow();
    expect(() => parseQuotaAmount('1E3')).toThrow();
    expect(() => parseQuotaAmount('+1')).toThrow();
    expect(() => parseQuotaAmount('1,000')).toThrow();
  });

  it('超过 8 位小数被拒绝', () => {
    expect(() => parseQuotaAmount('0.123456789')).toThrow();
  });

  it('positive 选项要求严格大于 0', () => {
    expect(parseQuotaAmount('1', { positive: true })).toBe(1);
    expect(() => parseQuotaAmount('0', { positive: true })).toThrow();
    expect(() => parseQuotaAmount('0.0', { positive: true })).toThrow();
  });
});

describe('validateDisplayName：Unicode 码点 1..50', () => {
  it('trim 后返回清洗值', () => {
    expect(validateDisplayName('  张三  ')).toBe('张三');
  });

  it('空白名称被拒绝', () => {
    expect(() => validateDisplayName('   ')).toThrow();
    expect(() => validateDisplayName('')).toThrow();
  });

  it('50 个码点通过，51 个拒绝', () => {
    expect(validateDisplayName('a'.repeat(50))).toBe('a'.repeat(50));
    expect(() => validateDisplayName('a'.repeat(51))).toThrow();
  });

  it('emoji 按码点而非 UTF-16 长度计数', () => {
    const emoji = '😀'.repeat(50);
    expect(validateDisplayName(emoji)).toBe(emoji);
    expect(() => validateDisplayName('😀'.repeat(51))).toThrow();
  });
});

describe('createQuotaDraft：null/0 语义', () => {
  it('无成员时默认静态、金额为空', () => {
    const draft = createQuotaDraft();
    expect(draft.mode).toBe('static');
    expect(draft.amount).toBe('');
    expect(draft.unlimited).toBe(false);
  });

  it('owner 金额全 null 时不限额且不猜 0', () => {
    const draft = createQuotaDraft(member({ isOwner: true, limit: null }));
    expect(draft.mode).toBe('static');
    expect(draft.unlimited).toBe(true);
    expect(draft.amount).toBe('');
  });

  it('普通成员 0 上限保持 0 且不是不限额', () => {
    const draft = createQuotaDraft(member({ limit: 0 }));
    expect(draft.unlimited).toBe(false);
    expect(draft.amount).toBe('0');
  });

  it('周期额度回填金额与天数', () => {
    const draft = createQuotaDraft(
      member({
        quota: {
          mode: 'periodic_active',
          amount: 50,
          periodDays: 30,
          startAt: '2026-01-01T00:00:00Z',
          windowStart: null,
          windowEnd: null,
        },
      }),
    );
    expect(draft.mode).toBe('periodic');
    expect(draft.amount).toBe('50');
    expect(draft.periodDays).toBe('30');
  });
});

describe('buildMemberQuotaPayload：static / periodic 边界', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0);

  it('static 不限额提交 spending_limit:null', () => {
    const payload = buildMemberQuotaPayload(staticDraft({ unlimited: true }), now);
    expect(payload.kind).toBe('static');
    expect(payload.body).toEqual({ spending_limit: null });
  });

  it('static 数字 0 保持 0，不变成 null', () => {
    const payload = buildMemberQuotaPayload(staticDraft({ amount: '0' }), now);
    expect(payload.body).toEqual({ spending_limit: 0 });
  });

  it('periodic 立即生效省略 start_at', () => {
    const payload = buildMemberQuotaPayload(
      staticDraft({ mode: 'periodic', amount: '30', periodDays: '7', starts: 'now' }),
      now,
    );
    expect(payload.kind).toBe('periodic');
    if (payload.kind !== 'periodic') throw new Error('unreachable');
    expect(payload.body.quota).toEqual({ amount: 30, period_days: 7 });
    expect(Object.prototype.hasOwnProperty.call(payload.body.quota ?? {}, 'start_at')).toBe(false);
  });

  it('periodic 指定未来日历日期按本地 0 点转 ISO', () => {
    const payload = buildMemberQuotaPayload(
      staticDraft({
        mode: 'periodic',
        amount: '30',
        periodDays: '7',
        starts: 'date',
        startDate: '2026-06-01',
      }),
      now,
    );
    if (payload.kind !== 'periodic') throw new Error('unreachable');
    expect(payload.body.quota?.start_at).toBe(new Date(2026, 5, 1, 0, 0, 0).toISOString());
  });

  it('不存在的日期 2026-02-30 被拒绝', () => {
    expect(() =>
      buildMemberQuotaPayload(
        staticDraft({
          mode: 'periodic',
          amount: '30',
          periodDays: '7',
          starts: 'date',
          startDate: '2026-02-30',
        }),
        now,
      ),
    ).toThrow();
  });

  it('过去日期被拒绝', () => {
    expect(() =>
      buildMemberQuotaPayload(
        staticDraft({
          mode: 'periodic',
          amount: '30',
          periodDays: '7',
          starts: 'date',
          startDate: '2025-12-31',
        }),
        now,
      ),
    ).toThrow();
  });

  it('periodic 不限额表示取消周期（quota:null）', () => {
    const payload = buildMemberQuotaPayload(
      staticDraft({ mode: 'periodic', unlimited: true, amount: '', periodDays: '' }),
      now,
    );
    if (payload.kind !== 'periodic') throw new Error('unreachable');
    expect(payload.body.quota).toBeNull();
  });

  it('周期天数只接受 1..3650 的整数', () => {
    const days = (value: string) =>
      buildMemberQuotaPayload(
        staticDraft({ mode: 'periodic', amount: '1', periodDays: value }),
        now,
      );
    expect(() => days('0')).toThrow();
    expect(() => days('3651')).toThrow();
    expect(() => days('1.5')).toThrow();
    expect(() => days('abc')).toThrow();
    expect(() => days('')).toThrow();
    expect(days('1')).toBeDefined();
    expect(days('3650')).toBeDefined();
  });
});

describe('buildDefaultQuotaPayload：disabled 清额 / enabled 0 有效', () => {
  it('关闭时不提交 amount / period_days，同步开关原样提交', () => {
    const payload = buildDefaultQuotaPayload({
      enabled: false,
      amount: '100',
      periodDays: '30',
      syncUnconfigured: false,
      syncConfigured: false,
    });
    expect(payload.enabled).toBe(false);
    expect(payload.sync_unconfigured).toBe(false);
    expect(payload.sync_configured).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'amount')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'period_days')).toBe(false);
  });

  it('关闭时即使草稿残留同步 flags=true，也一律提交 false', () => {
    const payload = buildDefaultQuotaPayload({
      enabled: false,
      amount: '100',
      periodDays: '30',
      syncUnconfigured: true,
      syncConfigured: true,
    });
    expect(payload.enabled).toBe(false);
    expect(payload.sync_unconfigured).toBe(false);
    expect(payload.sync_configured).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'amount')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'period_days')).toBe(false);
  });

  it('启用时 0 金额有效并原样提交', () => {
    const payload = buildDefaultQuotaPayload({
      enabled: true,
      amount: '0',
      periodDays: '30',
      syncUnconfigured: false,
      syncConfigured: false,
    });
    expect(payload.amount).toBe(0);
    expect(payload.period_days).toBe(30);
  });

  it('启用但金额为空或天数非法时拒绝', () => {
    expect(() =>
      buildDefaultQuotaPayload({
        enabled: true,
        amount: '',
        periodDays: '30',
        syncUnconfigured: false,
        syncConfigured: false,
      }),
    ).toThrow();
    expect(() =>
      buildDefaultQuotaPayload({
        enabled: true,
        amount: '10',
        periodDays: '0',
        syncUnconfigured: false,
        syncConfigured: false,
      }),
    ).toThrow();
  });
});

describe('invitationStatus：unused/used/disabled/expired 与真实 now', () => {
  const now = new Date(2026, 5, 1, 12, 0, 0);
  const base = {
    id: 1,
    code: 'CODE',
    createdAt: '2026-01-01T00:00:00Z',
    usedAt: null,
  };

  it('unused 未到期保持 unused', () => {
    expect(
      invitationStatus({ ...base, status: 'unused', expiresAt: '2026-06-02T00:00:00Z' }, now),
    ).toBe('unused');
  });

  it('unused 且已到期派生 expired', () => {
    expect(
      invitationStatus({ ...base, status: 'unused', expiresAt: '2026-05-31T00:00:00Z' }, now),
    ).toBe('expired');
  });

  it('used 优先于到期', () => {
    expect(
      invitationStatus({ ...base, status: 'used', expiresAt: '2026-05-31T00:00:00Z' }, now),
    ).toBe('used');
  });

  it('disabled 原样返回', () => {
    expect(invitationStatus({ ...base, status: 'disabled', expiresAt: null }, now)).toBe(
      'disabled',
    );
  });

  it('未知状态归 unknown', () => {
    expect(invitationStatus({ ...base, status: 'unknown', expiresAt: null }, now)).toBe('unknown');
  });
});

describe('memberLabel：displayName/username/email/编号兜底', () => {
  it('依次兜底', () => {
    expect(memberLabel(member({ displayName: '张三' }))).toBe('张三');
    expect(memberLabel(member({ displayName: '', username: 'user' }))).toBe('user');
    expect(memberLabel(member({ displayName: '', username: '', email: 'a@b.c' }))).toBe('a@b.c');
    expect(memberLabel(member({ displayName: '', username: '', email: '', userId: 42 }))).toContain(
      '42',
    );
  });
});

describe('adapter：缺失报错与合法 null 区分', () => {
  it('成员缺 spending_limit 字段报错，不猜 0', () => {
    const record = memberRecord();
    delete record.spending_limit;
    expect(() => parseMember(record)).toThrow();
  });

  it('owner 金额显式 null 合法保留', () => {
    const parsed = parseMember(
      memberRecord({
        is_owner: true,
        spending_limit: null,
        spending_used: null,
        spending_frozen: null,
        spending_remaining: null,
      }),
    );
    expect(parsed.limit).toBeNull();
    expect(parsed.used).toBeNull();
    expect(parsed.isOwner).toBe(true);
  });

  it('普通成员 limit:null 保留为不限，limit:0 保留 0', () => {
    expect(parseMember(memberRecord({ spending_limit: null })).limit).toBeNull();
    expect(parseMember(memberRecord({ spending_limit: 0 })).limit).toBe(0);
  });

  it('普通成员 used/frozen 显式 null 不合法，与 owner 不同', () => {
    expect(() => parseMember(memberRecord({ is_owner: false, spending_used: null }))).toThrow();
    expect(() => parseMember(memberRecord({ is_owner: false, spending_frozen: null }))).toThrow();
    // 缺失同样不合法，不能把「未返回」当成 0。
    const missingUsed = memberRecord();
    delete missingUsed.spending_used;
    expect(() => parseMember(missingUsed)).toThrow();
  });

  it('quota null 表示 static，不伪造周期', () => {
    expect(parseMember(memberRecord({ quota: null })).quota).toBeNull();
  });

  it('quota 窗口可 null，但 mode 非法拒绝', () => {
    const parsed = parseMember(
      memberRecord({
        quota: {
          mode: 'periodic_active',
          amount: 10,
          period_days: 30,
          start_at: '2026-01-01T00:00:00Z',
          window_start: null,
          window_end: null,
        },
      }),
    );
    expect(parsed.quota?.windowStart).toBeNull();
    expect(() =>
      parseMember(
        memberRecord({
          quota: {
            mode: 'weird',
            amount: 10,
            period_days: 30,
            start_at: '2026-01-01T00:00:00Z',
          },
        }),
      ),
    ).toThrow();
  });

  it('不把上游私有字段透传', () => {
    const parsed = parseMember(memberRecord({ password: 'x', api_key: 'sk-secret' }));
    expect(parsed).not.toHaveProperty('password');
    expect(parsed).not.toHaveProperty('apiKey');
  });

  it('未知成员状态归 unknown，不伪造 active', () => {
    expect(parseMember(memberRecord({ status: 'banned' })).status).toBe('unknown');
  });

  it('parseOrganization：null/undefined 个人无组织', () => {
    expect(parseOrganization(null)).toBeNull();
    expect(parseOrganization(undefined)).toBeNull();
    const org = parseOrganization({
      id: 1,
      name: 'Acme',
      is_owner: true,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(org?.isOwner).toBe(true);
  });

  it('parseMemberPage：pages 缺失按 ceil(total/page_size)', () => {
    const page = parseMemberPage({
      items: [memberRecord()],
      total: 401,
      page: 1,
      page_size: 200,
    });
    expect(page.pages).toBe(3);
    expect(page.items).toHaveLength(1);
  });

  it('parseInvitations：expires_at/used_at 可省略', () => {
    const parsed = parseInvitations([
      { id: 1, code: 'A', status: 'unused', created_at: '2026-01-01T00:00:00Z' },
    ]);
    expect(parsed[0]?.expiresAt).toBeNull();
    expect(parsed[0]?.usedAt).toBeNull();
  });

  it('parseDefaultQuota：disabled 时金额可 null，enabled 时不允许 null', () => {
    expect(parseDefaultQuota({ enabled: false, amount: null, period_days: null })).toEqual({
      enabled: false,
      amount: null,
      periodDays: null,
    });
    expect(() => parseDefaultQuota({ enabled: true, amount: null, period_days: 30 })).toThrow();
  });

  it('parseDefaultQuotaResult：synced_users 缺失报错，不猜 0', () => {
    const quota = { enabled: false, amount: null, period_days: null };
    expect(parseDefaultQuotaResult({ quota, synced_users: 3 }).syncedUsers).toBe(3);
    expect(() => parseDefaultQuotaResult({ quota })).toThrow();
  });
});

describe('API：方法与 path 只对应本人组织', () => {
  it('fetchOrganization GET /organization，不携带组织编号', async () => {
    const { request, calls } = makeRequester(() => null);
    await fetchOrganization(request);
    const call = firstCall(calls);
    expect(call.path).toBe('/organization');
    expect(call.options?.method).toBe('GET');
  });

  it('fetchMembers GET /organization/members 带 page/page_size', async () => {
    const { request, calls } = makeRequester(() => ({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    }));
    await fetchMembers(request, { page: 1, pageSize: 20, search: ' a ', status: 'active' });
    const call = firstCall(calls);
    expect(call.path).toContain('/organization/members?');
    expect(call.path).toContain('page=1');
    expect(call.path).toContain('page_size=20');
    expect(call.path).toContain('search=a');
    expect(call.path).toContain('status=active');
  });

  it('id 非正数时拒绝且不发请求', async () => {
    const { request, calls } = makeRequester(() => ({}));
    await expect(updateMemberName(request, 0, 'x')).rejects.toThrow();
    await expect(setMemberStatus(request, -1, 'active')).rejects.toThrow();
    await expect(disableInvitation(request, 1.5)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('createInvitation 无到期日期时不带 expires_at', async () => {
    const { request, calls } = makeRequester(() => ({
      id: 1,
      code: 'A',
      status: 'unused',
      created_at: '2026-01-01T00:00:00Z',
    }));
    await createInvitation(request);
    const call = firstCall(calls);
    expect(call.options?.method).toBe('POST');
    expect(call.path).toBe('/organization/invitations');
    expect(Object.prototype.hasOwnProperty.call(call.options?.body ?? {}, 'expires_at')).toBe(
      false,
    );
  });

  it('fetchInvitations GET 裸数组', async () => {
    const { request, calls } = makeRequester(() => []);
    await fetchInvitations(request);
    expect(firstCall(calls).path).toBe('/organization/invitations');
  });
});

describe('API：static 走 spending-limit，批量不冒充静态', () => {
  it('saveMemberQuota static 走 /spending-limit', async () => {
    const { request, calls } = makeRequester(() => memberRecord({ spending_limit: 0 }));
    await saveMemberQuota(request, 7, staticDraft({ amount: '0' }));
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/members/7/spending-limit');
    expect(call.options?.method).toBe('PUT');
    expect(call.options?.body).toEqual({ spending_limit: 0 });
  });

  it('saveMemberQuota periodic 走 /quota', async () => {
    const { request, calls } = makeRequester(() => memberRecord());
    await saveMemberQuota(
      request,
      7,
      staticDraft({ mode: 'periodic', amount: '10', periodDays: '30', starts: 'now' }),
    );
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/members/7/quota');
    expect(call.options?.body).toEqual({ quota: { amount: 10, period_days: 30 } });
  });

  it('saveBatchQuota 传静态草稿时拒绝，不误走周期', async () => {
    const { request, calls } = makeRequester(() => []);
    await expect(saveBatchQuota(request, [1, 2], staticDraft())).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('saveBatchQuota 周期走 quota-batch，ids 去重排序', async () => {
    const { request, calls } = makeRequester(() => []);
    await saveBatchQuota(
      request,
      [3, 1, 3, 2],
      staticDraft({ mode: 'periodic', amount: '5', periodDays: '10' }),
    );
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/members/quota-batch');
    expect((call.options?.body as Record<string, unknown>).user_ids).toEqual([1, 2, 3]);
  });

  it('splitMemberLimits ids 去重排序，非法 id 拒绝', async () => {
    const { request, calls } = makeRequester(() => []);
    await splitMemberLimits(request, [5, 5, 2], '100');
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/members/spending-limit-split');
    expect((call.options?.body as Record<string, unknown>).user_ids).toEqual([2, 5]);
    await expect(splitMemberLimits(request, [0], '100')).rejects.toThrow();
  });

  it('saveDefaultQuota PUT /organization/default-quota', async () => {
    const { request, calls } = makeRequester(() => ({
      quota: { enabled: false, amount: null, period_days: null },
      synced_users: 0,
    }));
    await saveDefaultQuota(request, {
      enabled: false,
      amount: '',
      periodDays: '',
      syncUnconfigured: false,
      syncConfigured: false,
    });
    const call = firstCall(calls);
    expect(call.path).toBe('/organization/default-quota');
    expect(call.options?.method).toBe('PUT');
  });

  it('fetchDefaultQuota GET /organization/default-quota', async () => {
    const { request, calls } = makeRequester(() => ({
      enabled: false,
      amount: null,
      period_days: null,
    }));
    await fetchDefaultQuota(request);
    expect(firstCall(calls).path).toBe('/organization/default-quota');
  });
});

describe('fetchAllMemberOptions：分页不截断、失败不残缺', () => {
  it('超过 200 继续分页并读完整列表', async () => {
    const total = 450;
    const { request, calls } = makeRequester((path) => {
      const page = Number(new URLSearchParams(path.split('?')[1] ?? '').get('page') ?? '1');
      const start = (page - 1) * 200;
      const size = Math.max(0, Math.min(200, total - start));
      return {
        items: Array.from({ length: size }, (_, index) =>
          memberRecord({ user_id: start + index + 1 }),
        ),
        total,
        page,
        page_size: 200,
      };
    });
    const all = await fetchAllMemberOptions(request);
    expect(all).toHaveLength(total);
    expect(calls.length).toBe(3);
    expect(calls[1]?.path).toContain('page=2');
  });

  it('中途某页失败时整体失败，不返回残缺列表', async () => {
    let call = 0;
    const { request } = makeRequester(() => {
      call += 1;
      if (call === 1) {
        return {
          items: Array.from({ length: 200 }, (_, index) => memberRecord({ user_id: index + 1 })),
          total: 400,
          page: 1,
          page_size: 200,
        };
      }
      throw new Error('boom');
    });
    await expect(fetchAllMemberOptions(request)).rejects.toThrow();
  });

  it('合法零成员返回空列表，不算失败', async () => {
    const { request, calls } = makeRequester(() => ({
      items: [],
      total: 0,
      page: 1,
      page_size: 200,
    }));
    await expect(fetchAllMemberOptions(request)).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('空页但 total 仍大于已收集人数时失败，不能当完整列表', async () => {
    const { request } = makeRequester(() => ({
      items: [],
      total: 400,
      page: 1,
      page_size: 200,
    }));
    await expect(fetchAllMemberOptions(request)).rejects.toThrow();
  });

  it('到达最后一页但 total 仍大于已收集人数时失败，不静默截断', async () => {
    // 第二页只返回 50 人，但后端声明 total=400：说明列表不完整，不能当成功。
    const { request } = makeRequester((path) => {
      const page = Number(new URLSearchParams(path.split('?')[1] ?? '').get('page') ?? '1');
      if (page === 1) {
        return {
          items: Array.from({ length: 200 }, (_, index) => memberRecord({ user_id: index + 1 })),
          total: 400,
          page: 1,
          page_size: 200,
          pages: 2,
        };
      }
      return {
        items: Array.from({ length: 50 }, (_, index) => memberRecord({ user_id: 200 + index + 1 })),
        total: 400,
        page: 2,
        page_size: 200,
        pages: 2,
      };
    });
    await expect(fetchAllMemberOptions(request)).rejects.toThrow();
  });
});
