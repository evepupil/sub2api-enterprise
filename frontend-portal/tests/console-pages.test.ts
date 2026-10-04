import { describe, expect, it } from 'vitest';

import {
  formatUsdWhole,
  parseRechargeAmount,
  roundCents,
} from '@/blocks/console/billing/billing-rules';
import { chatReducer, createChatState, STREAM_STEP } from '@/blocks/console/chat/chat-reducer';
import { clearFilters, DEFAULT_QUERY, paginationKey } from '@/blocks/console/models/models-state';
import {
  isValidTwoFactorCode,
  sanitizeTwoFactorCode,
  validatePasswordForm,
  validateProfileName,
} from '@/blocks/console/settings/settings-validation';
import { CHAT_REPLIES, CHAT_SAMPLE } from '@/lib/console';

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
