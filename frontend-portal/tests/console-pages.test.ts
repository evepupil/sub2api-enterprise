import { describe, expect, it } from 'vitest';

import {
  appendTransactions,
  bonusTierFor,
  newTransaction,
} from '@/blocks/console/billing/billing-ledger';
import {
  checkRedeemCode,
  formatUsdWhole,
  isHttpsUrl,
  isThresholdValid,
  parseRechargeAmount,
  roundCents,
} from '@/blocks/console/billing/billing-rules';
import { chatReducer, createChatState, STREAM_STEP } from '@/blocks/console/chat/chat-reducer';
import {
  applyKeyEdit,
  buildNewKey,
  draftFromKey,
  groupLabel,
  keyQuotaRatio,
  parseQuota,
  resolveExpiry,
  statusAfterEdit,
  toggleKeyStatus,
  toKeyRow,
  validateKeyDraft,
  type KeyDraft,
} from '@/blocks/console/keys/keys-model';
import { generateKeySecret } from '@/blocks/console/keys/keys-secret';
import { buildSnippet } from '@/blocks/console/keys/keys-snippets';
import { clearFilters, DEFAULT_QUERY, paginationKey } from '@/blocks/console/models/models-state';
import {
  buildInvitation,
  generateInviteCode,
  inviteLink,
} from '@/blocks/console/organization/organization-invite';
import {
  filterMembers,
  memberInitial,
  quotaLevel,
} from '@/blocks/console/organization/organization-model';
import {
  isValidTwoFactorCode,
  sanitizeTwoFactorCode,
  validatePasswordForm,
  validateProfileName,
} from '@/blocks/console/settings/settings-validation';
import {
  appendUserReply,
  buildTicket,
  nextTicketId,
  validateTicketDraft,
  withStatus,
} from '@/blocks/console/tickets/tickets-logic';
import { API_KEYS, CHAT_REPLIES, CHAT_SAMPLE, LEDGER, ORG_MEMBERS, TICKETS } from '@/lib/console';
import { SITE } from '@/lib/site';

const draft = (patch: Partial<KeyDraft> = {}): KeyDraft => ({
  name: '新密钥',
  quotaMode: 'unlimited',
  quota: '',
  expiry: 'never',
  ...patch,
});

describe('密钥页规则', () => {
  it('表单校验：名称必填且最多 32 个字（按字符算），自定义额度要在 1 到 100000 之间', () => {
    expect(validateKeyDraft(draft({ name: '  ' }))).toEqual({ name: 'required' });
    expect(validateKeyDraft(draft({ name: '密'.repeat(32) }))).toEqual({});
    expect(validateKeyDraft(draft({ name: '密'.repeat(33) }))).toEqual({ name: 'tooLong' });
    expect(validateKeyDraft(draft({ quotaMode: 'custom', quota: '0' }))).toEqual({
      quota: 'range',
    });
    expect(parseQuota('12.345')).toBe(12.35);
    expect(parseQuota('abc')).toBeNull();
  });

  it('有效期换算与过期恢复', () => {
    expect(resolveExpiry('never', '2026-12-31')).toBeNull();
    expect(resolveExpiry('keep', '2026-12-31')).toBe('2026-12-31');
    expect(resolveExpiry('30d', null)).toBe('2026-11-02');
    expect(statusAfterEdit('expired', null)).toBe('active');
    expect(statusAfterEdit('expired', '2026-10-01')).toBe('expired');
    expect(statusAfterEdit('paused', null)).toBe('paused');
  });

  it('新建、编辑、暂停与启用', () => {
    const created = buildNewKey(
      draft({ quotaMode: 'custom', quota: '50', expiry: '90d' }),
      'pro',
      'sk-ABCDEFGH12345678',
    );
    expect(created).toMatchObject({
      id: 'key-12345678',
      status: 'active',
      quotaUsd: 50,
      expiresAt: '2027-01-01',
      group: 'pro',
    });
    expect(created.usage.last30.requests).toBe(0);

    const legacy = toKeyRow(API_KEYS[4]!);
    expect(legacy.status).toBe('expired');
    expect(applyKeyEdit(legacy, { ...draftFromKey(legacy), expiry: 'never' }).status).toBe(
      'active',
    );
    expect(toggleKeyStatus(legacy)).toBe(legacy);

    const prod = toKeyRow(API_KEYS[0]!);
    const paused = toggleKeyStatus(prod);
    expect(paused).toMatchObject({ status: 'paused', pausedAt: '2026-10-03' });
    expect(toggleKeyStatus(paused)).toMatchObject({ status: 'active', pausedAt: null });
  });

  it('额度比例、通道名与接入示例', () => {
    expect(keyQuotaRatio(toKeyRow(API_KEYS[0]!))).toBeNull();
    expect(keyQuotaRatio(toKeyRow(API_KEYS[2]!))).toBeCloseTo(32.79 / 50, 3);
    expect(groupLabel('pro', 'zh')).toBe('专用通道 ×0.3');
    const snippet = buildSnippet('codex', 'sk-test');
    expect(snippet).toContain(`base_url = "${SITE.apiBase}/v1"`);
    expect(snippet).toContain('export CODU_API_KEY=sk-test');
    expect(buildSnippet('claude', 'sk-test')).toContain('ANTHROPIC_AUTH_TOKEN=sk-test');
    expect(generateKeySecret()).toMatch(/^sk-[0-9A-Za-z]{40}$/);
  });
});

describe('组织页规则', () => {
  it('配额提醒档位与成员搜索', () => {
    expect(quotaLevel(0.5)).toBe('ok');
    expect(quotaLevel(0.8)).toBe('warning');
    expect(quotaLevel(1)).toBe('full');
    expect(filterMembers(ORG_MEMBERS, '陈').map((m) => m.id)).toEqual(['m-2']);
    expect(filterMembers(ORG_MEMBERS, 'ZHAO').map((m) => m.id)).toEqual(['m-4']);
    expect(filterMembers(ORG_MEMBERS, '')).toHaveLength(5);
    expect(memberInitial('siyuan')).toBe('S');
  });

  it('邀请码格式与有效期', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^ORG-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(inviteLink('ORG-AB12-CD34')).toBe('https://codu.example/register?org=ORG-AB12-CD34');
    expect(buildInvitation(code, '7d')).toMatchObject({
      createdAt: '2026-10-03',
      expiresAt: '2026-10-10',
      status: 'active',
      usedBy: null,
    });
  });
});

describe('账单页规则', () => {
  it('兑换码先去空白转大写再校验', () => {
    expect(checkRedeemCode('   ')).toEqual({ ok: false, reason: 'required' });
    expect(checkRedeemCode('codu test 2026')).toEqual({ ok: false, reason: 'format' });
    expect(checkRedeemCode(' codu-test-2026 ')).toEqual({ ok: true, code: 'CODU-TEST-2026' });
  });

  it('金额、阈值、Webhook 地址', () => {
    expect(roundCents(10.005)).toBe(10.01);
    expect(parseRechargeAmount('4.99')).toBeNull();
    expect(parseRechargeAmount('5')).toBe(5);
    expect(parseRechargeAmount('10001')).toBeNull();
    expect(isThresholdValid(0)).toBe(true);
    expect(isThresholdValid(null)).toBe(false);
    expect(isHttpsUrl('https://hooks.example.com/x')).toBe(true);
    expect(isHttpsUrl('http://hooks.example.com')).toBe(false);
    expect(formatUsdWhole(10000)).toBe('US$10,000');
    expect(formatUsdWhole(9.5)).toBe('US$9.50');
  });

  it('新流水并进账本后余额跟着变，赠送档位从高到低取', () => {
    const ledger = appendTransactions(LEDGER, [
      newTransaction('redeem', 10, null, '兑换码 CODU-TEST-2026'),
    ]);
    expect(ledger).toHaveLength(LEDGER.length + 1);
    expect(ledger[0]?.type).toBe('redeem');
    expect(ledger[0]?.balanceUsd).toBeCloseTo((LEDGER[0]?.balanceUsd ?? 0) + 10, 6);
    expect(bonusTierFor(100)).toBeUndefined();
    expect(bonusTierFor(300)?.rate).toBe(0.05);
    expect(bonusTierFor(800)?.rate).toBe(0.1);
  });
});

describe('工单页规则', () => {
  const empty = { subject: '', category: 'api' as const, requestId: '', body: '' };

  it('新建校验：所有出错字段一起返回', () => {
    expect(validateTicketDraft(empty)).toEqual({
      subject: 'subjectRequired',
      body: 'bodyRequired',
    });
    expect(
      validateTicketDraft({ ...empty, subject: '标题', requestId: 'abc', body: '太短' }),
    ).toEqual({ requestId: 'requestPrefix', body: 'bodyTooShort' });
  });

  it('编号递增，回复后回到处理中', () => {
    expect(nextTicketId(TICKETS)).toBe('T-1025');
    expect(nextTicketId([])).toBe('T-1001');
    const ticket = buildTicket(
      { ...empty, subject: ' 测试工单 ', body: '生图接口返回 500 错误，请帮忙看看' },
      TICKETS,
    );
    expect(ticket).toMatchObject({ id: 'T-1025', status: 'open', requestId: null });
    expect(ticket.subject.zh).toBe('测试工单');
    const resolved = withStatus(ticket, 'resolved');
    expect(resolved.status).toBe('resolved');
    const replied = appendUserReply(resolved, '又出现了');
    expect(replied.status).toBe('open');
    expect(replied.messages).toHaveLength(2);
  });
});

describe('账户设置规则', () => {
  it('名称与密码校验', () => {
    expect(validateProfileName('  ')).toBe('nameRequired');
    expect(validateProfileName('林舟')).toBeNull();
    expect(validatePasswordForm({ current: '', next: '123', confirm: '12' })).toEqual({
      current: 'currentRequired',
      next: 'newTooShort',
      confirm: 'confirmMismatch',
    });
    expect(
      validatePasswordForm({ current: 'oldpass123', next: 'oldpass123', confirm: 'oldpass123' }),
    ).toEqual({ next: 'newSameAsCurrent' });
  });

  it('动态码只收 6 位数字', () => {
    expect(sanitizeTwoFactorCode('12-34 567')).toBe('123456');
    expect(isValidTwoFactorCode('123456')).toBe(true);
    expect(isValidTwoFactorCode('12345')).toBe(false);
  });
});

describe('对话页逐字输出', () => {
  it('发送后逐字补满回复，输出中不接新消息', () => {
    let state = createChatState(CHAT_SAMPLE);
    state = chatReducer(state, { type: 'send', text: '你好', model: 'gpt-6-sol', locale: 'zh' });
    expect(state.messages).toHaveLength(4);
    expect(state.streaming?.shown).toBe(0);
    expect(
      chatReducer(state, { type: 'send', text: '再来', model: 'gpt-6-sol', locale: 'zh' }),
    ).toBe(state);
    const full = CHAT_REPLIES[0]?.zh ?? '';
    for (let i = 0; i < Math.ceil(full.length / STREAM_STEP); i++) {
      state = chatReducer(state, { type: 'tick' });
    }
    expect(state.streaming).toBeNull();
    expect(state.messages.at(-1)?.content.zh).toBe(full);
  });

  it('停止时保留已显示的部分，一个字没出就去掉空回复；新对话清空', () => {
    let state = chatReducer(createChatState([]), {
      type: 'send',
      text: '你好',
      model: 'gpt-6-sol',
      locale: 'zh',
    });
    const stoppedEarly = chatReducer(state, { type: 'stop' });
    expect(stoppedEarly.messages.map((m) => m.role)).toEqual(['user']);
    state = chatReducer(chatReducer(state, { type: 'tick' }), { type: 'tick' });
    const stopped = chatReducer(state, { type: 'stop' });
    expect(stopped.messages.at(-1)?.content.zh).toHaveLength(STREAM_STEP * 2);
    expect(chatReducer(stopped, { type: 'reset' }).messages).toEqual([]);
  });
});

describe('模型页筛选条件', () => {
  it('清除筛选保留排序；换范围或改筛选都回第 1 页', () => {
    expect(clearFilters({ ...DEFAULT_QUERY, type: 'image', sort: 'price-asc' })).toEqual({
      ...DEFAULT_QUERY,
      sort: 'price-asc',
    });
    const base = paginationKey('all', DEFAULT_QUERY);
    expect(paginationKey('favorites', DEFAULT_QUERY)).not.toBe(base);
    expect(paginationKey('all', { ...DEFAULT_QUERY, query: 'gpt' })).not.toBe(base);
  });
});
