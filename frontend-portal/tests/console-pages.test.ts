import { describe, expect, it } from 'vitest';

import {
  formatUsdWhole,
  parseRechargeAmount,
  roundCents,
} from '@/blocks/console/billing/billing-rules';
import { chatReducer, createChatState, STREAM_STEP } from '@/blocks/console/chat/chat-reducer';
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
import { CHAT_REPLIES, CHAT_SAMPLE, ORG_MEMBERS, TICKETS } from '@/lib/console';
import { SITE } from '@/lib/site';

describe('密钥页接入示例', () => {
  it('地址取站点配置，密钥填这一行的完整密钥', () => {
    const snippet = buildSnippet('codex', 'sk-test');
    expect(snippet).toContain(`base_url = "${SITE.apiBase}/v1"`);
    expect(snippet).toContain('export CODU_API_KEY=sk-test');
    expect(buildSnippet('claude', 'sk-test')).toContain('ANTHROPIC_AUTH_TOKEN=sk-test');
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

describe('账单页充值弹窗的金额规则', () => {
  it('自定义金额取到分并落在限额内，整数金额不带小数', () => {
    expect(roundCents(10.005)).toBe(10.01);
    expect(parseRechargeAmount('4.99')).toBeNull();
    expect(parseRechargeAmount('5')).toBe(5);
    expect(parseRechargeAmount('10001')).toBeNull();
    expect(formatUsdWhole(10000)).toBe('US$10,000');
    expect(formatUsdWhole(9.5)).toBe('US$9.50');
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
