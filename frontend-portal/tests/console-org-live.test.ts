import { describe, expect, it } from 'vitest';

import {
  isExhausted,
  memberLabel,
  parsePeriodic,
  policyOf,
  quotaDraftOf,
  quotaUpdateOf,
} from '@/blocks/console/organization/organization-model';
import { visibleNav } from '@/components/console/shell/nav-items';
import {
  beijingLocalToIso,
  invitationExpiry,
  invitationStatus,
  inviteLink,
  isValidRequestRange,
  memberNameError,
  noteTooLong,
  parseAmount,
  parsePeriodDays,
  requestAmountError,
  splitAmounts,
} from '@/lib/console/live/org-rules';
import type { OrgInvitation, OrgMember } from '@/lib/console/live/org-types';
import {
  defaultQuotaPayload,
  memberBatchRequest,
  membersListPath,
  memberUpdateRequest,
  orgErrorFor,
  orgErrorStatus,
  parseDefaultQuotaInput,
  parseId,
  parseInvitationCreate,
  parseMemberBatch,
  parseMembersQuery,
  parseMemberUpdate,
  parsePolicyInput,
  parseQuotaRequestAction,
  parseQuotaRequestsQuery,
  parseQuotaRequestSubmit,
  quotaRequestActionRequest,
  toDefaultQuotaResult,
  toInvitation,
  toMembersPage,
  toMyOrgQuota,
  toOrgSummary,
  toPolicy,
  toQuotaRequest,
} from '@/lib/server/sub2api/organization';
import { SITE_FEATURES } from '@/lib/site';

const MEMBER: OrgMember = {
  userId: 5,
  email: 'dev@example.com',
  username: 'dev',
  status: 'active',
  isOwner: false,
  displayName: '',
  spendingLimit: 20,
  spendingUsed: 5,
  spendingFrozen: 0,
  spendingRemaining: 15,
  quota: null,
  joinedAt: '2026-09-01T00:00:00Z',
};

const DAY_MS = 86_400_000;

describe('组织页输入规则', () => {
  it('成员名称 1–50 个字（按字算），空白不算', () => {
    expect(memberNameError('  ')).toBe('required');
    expect(memberNameError('研发一组')).toBeNull();
    expect(memberNameError('名'.repeat(50))).toBeNull();
    expect(memberNameError('名'.repeat(51))).toBe('tooLong');
    expect(memberNameError('😀'.repeat(50))).toBeNull();
  });

  it('理由、备注最多 500 个字', () => {
    expect(noteTooLong('a'.repeat(500))).toBe(false);
    expect(noteTooLong(` ${'字'.repeat(500)} `)).toBe(false);
    expect(noteTooLong('字'.repeat(501))).toBe(true);
  });

  it('金额：空着、不是数字、负数、太大都不行；0 可以', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('1000001')).toBeNull();
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount(' 12.5 ')).toBe(12.5);
  });

  it('周期天数是 1–3650 的整数', () => {
    expect(parsePeriodDays('0')).toBeNull();
    expect(parsePeriodDays('1.5')).toBeNull();
    expect(parsePeriodDays('3651')).toBeNull();
    expect(parsePeriodDays('30')).toBe(30);
  });

  it('申请范围：最低大于 0，最高不低于最低', () => {
    expect(isValidRequestRange(0, 10)).toBe(false);
    expect(isValidRequestRange(10, 5)).toBe(false);
    expect(isValidRequestRange(null, 5)).toBe(false);
    expect(isValidRequestRange(5, 5)).toBe(true);
  });

  it('成员申请的金额：要大于 0，管理员设了范围时要在范围里', () => {
    expect(requestAmountError('', 5, 100)).toBe('amount');
    expect(requestAmountError('0', 5, 100)).toBe('amount');
    expect(requestAmountError('4.99', 5, 100)).toBe('range');
    expect(requestAmountError('100.01', 5, 100)).toBe('range');
    expect(requestAmountError('50', 5, 100)).toBeNull();
    expect(requestAmountError('50', null, null)).toBeNull();
  });

  it('北京时间的生效时间带上 +08:00；格式不对给 null', () => {
    expect(beijingLocalToIso('2026-10-05T09:30')).toBe('2026-10-05T09:30:00+08:00');
    expect(beijingLocalToIso('2026-10-05 09:30')).toBeNull();
    expect(beijingLocalToIso('')).toBeNull();
  });

  it('邀请码有效期：按天数算到期时间，长期有效是 null；过了期的有效码算已过期', () => {
    const now = Date.UTC(2026, 9, 4, 4, 0);
    expect(invitationExpiry(7, now)).toBe(new Date(now + 7 * DAY_MS).toISOString());
    expect(invitationExpiry(0, now)).toBeNull();

    const invitation: OrgInvitation = {
      id: 1,
      code: 'ABCD1234',
      status: 'unused',
      createdAt: '2026-10-01T00:00:00Z',
      expiresAt: '2026-10-04T03:00:00Z',
      usedAt: null,
    };
    expect(invitationStatus(invitation, now)).toBe('expired');
    expect(invitationStatus({ ...invitation, expiresAt: null }, now)).toBe('unused');
    expect(invitationStatus({ ...invitation, status: 'used' }, now)).toBe('used');
  });

  it('邀请链接是官网注册页，邀请码已经填好', () => {
    expect(inviteLink('https://portal.test', 'AB CD')).toBe(
      'https://portal.test/register?invitation_code=AB%20CD',
    );
  });

  it('平分上限：零头按成员 ID 从小到大补，各人之和等于总额', () => {
    const shares = splitAmounts([9, 3, 5], 10);
    expect([...shares.keys()]).toEqual([3, 5, 9]);
    expect(shares.get(3)).toBe(3.33333334);
    expect(shares.get(5)).toBe(3.33333333);
    expect(shares.get(9)).toBe(3.33333333);
    const units = [...shares.values()].reduce((sum, value) => sum + Math.round(value * 1e8), 0);
    expect(units).toBe(10 * 1e8);
    expect(splitAmounts([], 10).size).toBe(0);
    expect(splitAmounts([1, 1, 2], 1).size).toBe(2);
  });
});

describe('组织页表单', () => {
  it('设置配额的初始方式跟着成员现在的额度', () => {
    expect(quotaDraftOf(MEMBER)).toMatchObject({ mode: 'fixed', amount: '20' });
    expect(quotaDraftOf({ ...MEMBER, spendingLimit: null })).toMatchObject({ mode: 'unlimited' });
    expect(
      quotaDraftOf({
        ...MEMBER,
        quota: {
          mode: 'periodic_active',
          amount: 50,
          periodDays: 30,
          startAt: '2026-10-01T00:00:00Z',
          windowStart: null,
          windowEnd: null,
        },
      }),
    ).toMatchObject({ mode: 'periodic', amount: '50', periodDays: '30', immediate: true });
  });

  it('周期配额：立即生效不带开始时间；指定时间要选好', () => {
    const draft = { amount: '50', periodDays: '30', immediate: true, startAt: '' };
    expect(parsePeriodic(draft)).toEqual({ amount: 50, periodDays: 30, startAt: null });
    expect(parsePeriodic({ ...draft, amount: '' })).toBe('amount');
    expect(parsePeriodic({ ...draft, periodDays: '0' })).toBe('period');
    expect(parsePeriodic({ ...draft, immediate: false })).toBe('start');
    expect(parsePeriodic({ ...draft, immediate: false, startAt: '2026-10-05T09:30' })).toEqual({
      amount: 50,
      periodDays: 30,
      startAt: '2026-10-05T09:30:00+08:00',
    });
  });

  it('不限额、固定上限走消费上限，周期配额走周期配额；固定上限可以是 0', () => {
    const base = { amount: '0', periodDays: '', immediate: true, startAt: '' };
    expect(quotaUpdateOf({ ...base, mode: 'unlimited' })).toEqual({
      kind: 'limit',
      spendingLimit: null,
    });
    expect(quotaUpdateOf({ ...base, mode: 'fixed' })).toEqual({ kind: 'limit', spendingLimit: 0 });
    expect(quotaUpdateOf({ ...base, mode: 'fixed', amount: '' })).toBe('amount');
    expect(quotaUpdateOf({ ...base, mode: 'periodic', amount: '10', periodDays: '7' })).toEqual({
      kind: 'quota',
      quota: { amount: 10, periodDays: 7, startAt: null },
    });
  });

  it('申请设置：关闭时不要范围；开启时范围要对', () => {
    expect(policyOf('off', '', '')).toEqual({ mode: 'off', minAmount: null, maxAmount: null });
    expect(policyOf('approve', '5', '100')).toEqual({
      mode: 'approve',
      minAmount: 5,
      maxAmount: 100,
    });
    expect(policyOf('auto', '0', '100')).toBe('range');
    expect(policyOf('auto', '10', '5')).toBe('range');
  });

  it('名字优先用组织内名称；剩余额度用完才算用完', () => {
    expect(memberLabel(MEMBER)).toBe('dev@example.com');
    expect(memberLabel({ ...MEMBER, displayName: ' 小王 ' })).toBe('小王');
    expect(isExhausted(MEMBER)).toBe(false);
    expect(isExhausted({ ...MEMBER, spendingRemaining: 0 })).toBe(true);
    expect(isExhausted({ ...MEMBER, spendingRemaining: null })).toBe(false);
  });

  it('侧栏的「组织」只给组织管理员', () => {
    const keys = (owner: boolean) => visibleNav(true, owner).map((item) => item.key);
    expect(keys(true)).toContain('organization');
    expect(keys(false)).not.toContain('organization');
    expect(keys(false)).toContain('invite');
  });

  it('官网文档入口没开时，侧栏也不显示「文档」', () => {
    const keys = visibleNav(true, true).map((item) => item.key);
    expect(keys.includes('docs')).toBe(SITE_FEATURES.docs);
  });
});

describe('组织接口：后端结果的转换', () => {
  it('组织概况：不在组织里时是 null', () => {
    expect(toOrgSummary(null)).toBeNull();
    expect(
      toOrgSummary({
        id: 2,
        name: '研发部',
        is_owner: true,
        status: 'disabled',
        created_at: '2026-09-01T00:00:00Z',
      }),
    ).toEqual({
      id: 2,
      name: '研发部',
      isOwner: true,
      status: 'disabled',
      createdAt: '2026-09-01T00:00:00Z',
    });
  });

  it('成员：周期配额、剩余额度与冻结金额都带上，看不懂的行丢掉', () => {
    const page = toMembersPage({
      items: [
        {
          user_id: 5,
          email: 'dev@example.com',
          username: 'dev',
          status: 'active',
          is_owner: false,
          display_name: '小王',
          spending_limit: null,
          spending_used: 1.5,
          spending_frozen: 0.2,
          spending_remaining: 8.3,
          quota: {
            mode: 'periodic_active',
            amount: 10,
            period_days: 7,
            start_at: '2026-10-01T00:00:00Z',
            window_start: '2026-10-01T00:00:00Z',
            window_end: '2026-10-08T00:00:00Z',
          },
          joined_at: '2026-09-01T00:00:00Z',
        },
        { email: 'no-id@example.com' },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    });
    expect(page?.items).toHaveLength(1);
    expect(page?.items[0]).toMatchObject({
      userId: 5,
      displayName: '小王',
      spendingLimit: null,
      spendingFrozen: 0.2,
      spendingRemaining: 8.3,
      quota: {
        mode: 'periodic_active',
        amount: 10,
        periodDays: 7,
        windowEnd: '2026-10-08T00:00:00Z',
      },
    });
    expect(toMembersPage({ total: 1 })).toBeNull();
  });

  it('邀请码、默认配额、申请策略、申请', () => {
    expect(
      toInvitation({ id: 3, code: 'ABCD', status: 'disabled', created_at: 'x', expires_at: null }),
    ).toMatchObject({ id: 3, status: 'disabled', expiresAt: null });
    expect(toInvitation({ id: 3 })).toBeNull();
    expect(
      toDefaultQuotaResult({
        quota: { enabled: true, amount: 10, period_days: 30 },
        synced_users: 4,
      }),
    ).toEqual({ defaultQuota: { enabled: true, amount: 10, periodDays: 30 }, syncedUsers: 4 });
    expect(toPolicy({ mode: 'weird' })).toEqual({ mode: 'off', minAmount: null, maxAmount: null });
    expect(
      toQuotaRequest({
        id: 9,
        user_id: 5,
        amount: 20,
        status: 'granted',
        granted_amount: 20,
        review_note: '同意',
        created_at: '2026-10-04T00:00:00Z',
      }),
    ).toMatchObject({ id: 9, status: 'granted', grantedAmount: 20, reviewNote: '同意' });
  });

  it('普通成员的组织配额从仪表盘统计里取；个人用户、组织管理员是 null', () => {
    expect(toMyOrgQuota({ total_requests: 1 })).toBeNull();
    expect(toMyOrgQuota({ organization_quota: null })).toBeNull();
    expect(
      toMyOrgQuota({
        organization_quota: {
          remaining: 3.5,
          window_end: '2026-10-08T00:00:00Z',
          can_request: true,
          request_mode: 'approve',
          min_amount: 5,
          max_amount: 100,
          pending_exists: false,
        },
      }),
    ).toEqual({
      remaining: 3.5,
      windowEnd: '2026-10-08T00:00:00Z',
      canRequest: true,
      requestMode: 'approve',
      minAmount: 5,
      maxAmount: 100,
      pendingExists: false,
    });
  });
});

describe('组织接口：参数与请求体', () => {
  it('地址里的 ID 与列表参数', () => {
    expect(parseId('12')).toBe(12);
    expect(parseId('012')).toBeNull();
    expect(parseId('-1')).toBeNull();
    const query = parseMembersQuery(
      new URLSearchParams('page=2&pageSize=50&search=dev&status=disabled'),
    );
    expect(query).toEqual({ page: 2, pageSize: 50, search: 'dev', status: 'disabled' });
    expect(membersListPath(query!)).toBe(
      '/organization/members?page=2&page_size=50&search=dev&status=disabled',
    );
    expect(parseMembersQuery(new URLSearchParams('status=owner'))).toBeNull();
    expect(parseQuotaRequestsQuery(new URLSearchParams('status=pending'))).toMatchObject({
      status: 'pending',
    });
    expect(parseQuotaRequestsQuery(new URLSearchParams('pageSize=7'))).toBeNull();
  });

  it('改成员：每种改动对应后端的一个接口；立即生效的周期配额不带开始时间', () => {
    expect(
      memberUpdateRequest(5, parseMemberUpdate({ kind: 'status', status: 'disabled' })!),
    ).toEqual({
      path: '/organization/members/5/status',
      body: { status: 'disabled' },
    });
    expect(
      memberUpdateRequest(5, parseMemberUpdate({ kind: 'name', displayName: ' 小王 ' })!),
    ).toEqual({
      path: '/organization/members/5/display-name',
      body: { display_name: '小王' },
    });
    expect(
      memberUpdateRequest(5, parseMemberUpdate({ kind: 'limit', spendingLimit: null })!),
    ).toEqual({
      path: '/organization/members/5/spending-limit',
      body: { spending_limit: null },
    });
    expect(
      memberUpdateRequest(
        5,
        parseMemberUpdate({ kind: 'quota', quota: { amount: 10, periodDays: 7, startAt: null } })!,
      ),
    ).toEqual({
      path: '/organization/members/5/quota',
      body: { quota: { amount: 10, period_days: 7 } },
    });
    expect(
      memberUpdateRequest(
        5,
        parseMemberUpdate({
          kind: 'quota',
          quota: { amount: 10, periodDays: 7, startAt: '2026-10-05T09:30:00+08:00' },
        })!,
      ).body,
    ).toEqual({ quota: { amount: 10, period_days: 7, start_at: '2026-10-05T09:30:00+08:00' } });
    expect(parseMemberUpdate({ kind: 'name', displayName: '' })).toBeNull();
    expect(parseMemberUpdate({ kind: 'limit', spendingLimit: -1 })).toBeNull();
    expect(
      parseMemberUpdate({ kind: 'quota', quota: { amount: 1, periodDays: 0, startAt: null } }),
    ).toBeNull();
    expect(parseMemberUpdate({ kind: 'owner' })).toBeNull();
  });

  it('批量：平分上限与周期发放；成员 ID 要是正整数且去重', () => {
    expect(
      memberBatchRequest(parseMemberBatch({ kind: 'split', userIds: [3, 5, 3], totalAmount: 10 })!),
    ).toEqual({
      path: '/organization/members/spending-limit-split',
      body: { user_ids: [3, 5], total_amount: 10 },
    });
    expect(
      memberBatchRequest(
        parseMemberBatch({
          kind: 'quota',
          userIds: [3],
          quota: { amount: 5, periodDays: 30, startAt: null },
        })!,
      ),
    ).toEqual({
      path: '/organization/members/quota-batch',
      body: { user_ids: [3], quota: { amount: 5, period_days: 30 } },
    });
    expect(parseMemberBatch({ kind: 'split', userIds: [], totalAmount: 10 })).toBeNull();
    expect(parseMemberBatch({ kind: 'split', userIds: [0], totalAmount: 10 })).toBeNull();
  });

  it('默认配额：关闭时不带金额；开启时金额与天数要对', () => {
    expect(defaultQuotaPayload(parseDefaultQuotaInput({ enabled: false })!)).toEqual({
      enabled: false,
      sync_unconfigured: false,
      sync_configured: false,
    });
    expect(
      defaultQuotaPayload(
        parseDefaultQuotaInput({
          enabled: true,
          amount: 10,
          periodDays: 30,
          syncUnconfigured: true,
        })!,
      ),
    ).toEqual({
      enabled: true,
      amount: 10,
      period_days: 30,
      sync_unconfigured: true,
      sync_configured: false,
    });
    expect(parseDefaultQuotaInput({ enabled: true, amount: 10 })).toBeNull();
  });

  it('申请策略、提交与处理申请、创建邀请码', () => {
    expect(parsePolicyInput({ mode: 'off', minAmount: 5 })).toEqual({
      mode: 'off',
      minAmount: null,
      maxAmount: null,
    });
    expect(parsePolicyInput({ mode: 'auto', minAmount: 0, maxAmount: 10 })).toBeNull();
    expect(parseQuotaRequestSubmit({ amount: 0 })).toBeNull();
    expect(parseQuotaRequestSubmit({ amount: 5, reason: ' 项目上线 ' })).toEqual({
      amount: 5,
      reason: '项目上线',
    });
    expect(parseQuotaRequestAction({ action: 'delete' })).toBeNull();
    expect(quotaRequestActionRequest(9, 'approve', '')).toEqual({
      path: '/organization/quota-requests/9/approve',
      body: { note: '' },
    });
    expect(quotaRequestActionRequest(9, 'withdraw', '')).toEqual({
      path: '/organization/quota-requests/9/withdraw',
      body: undefined,
    });
    expect(parseInvitationCreate({ days: 7 })).toBe(7);
    expect(parseInvitationCreate({ days: 0 })).toBe(0);
    expect(parseInvitationCreate({ days: 3 })).toBeNull();
  });

  it('后端错误码归成页面上的原因与状态码', () => {
    expect(
      orgErrorFor({ status: 409, reason: 'ORGANIZATION_QUOTA_REQUEST_NOT_PENDING', message: '' }),
    ).toBe('request_handled');
    expect(orgErrorFor({ status: 403, reason: 'SOMETHING_ELSE', message: '' })).toBe('forbidden');
    expect(orgErrorFor({ status: 502, reason: '', message: '' })).toBe('unavailable');
    expect(orgErrorFor({ status: 400, reason: '', message: '' })).toBe('invalid');
    expect(orgErrorStatus('request_handled')).toBe(409);
    expect(orgErrorStatus('owner_required')).toBe(403);
    expect(orgErrorStatus('member_not_found')).toBe(404);
    expect(orgErrorStatus('amount_invalid')).toBe(400);
  });
});
