import { describe, expect, it } from 'vitest';

import { ledgerSearchParams } from '@/lib/console/live/billing-client';
import type { BalanceSummary, LedgerQuery } from '@/lib/console/live/billing-types';
import {
  amountRange,
  balanceOutlook,
  isCurrentOrLaterMonth,
  isLowBalance,
  ledgerQueryKey,
  monthRangeOf,
  parseAmountFilter,
  shiftYearMonth,
  yearMonthOf,
} from '@/lib/console/live/billing-view';
import {
  ledgerPath,
  parseLedgerQuery,
  parseRedeemCode,
  redeemErrorFor,
  toBalanceSummary,
  toLedgerPage,
  toRedeemResult,
} from '@/lib/server/sub2api/balance';
import { backendError } from '@/lib/server/sub2api/envelope';

const summary = (patch: Partial<BalanceSummary> = {}): BalanceSummary => ({
  balanceUsd: 131.2,
  rechargedUsd: 2.8,
  bonusUsd: 0,
  consumedUsd: 15.0864,
  recentConsumedUsd: 15,
  recentDays: 30,
  ...patch,
});

const BASE_QUERY: LedgerQuery = {
  page: 1,
  pageSize: 20,
  type: null,
  source: null,
  query: '',
  minUsd: null,
  maxUsd: null,
  from: null,
  to: null,
};

describe('账单页：官网转发的参数校验', () => {
  it('不带参数时取第 1 页、每页 20 条、不筛选', () => {
    expect(parseLedgerQuery(new URLSearchParams())).toEqual(BASE_QUERY);
  });

  it('筛选条件原样带上，搜索词去掉首尾空白', () => {
    const query = parseLedgerQuery(
      new URLSearchParams(
        'page=2&size=50&type=recharge&source=alipay&q= sub2_ &min=1&max=50&from=2026-09-01&to=2026-09-30',
      ),
    );
    expect(query).toEqual({
      page: 2,
      pageSize: 50,
      type: 'recharge',
      source: 'alipay',
      query: 'sub2_',
      minUsd: 1,
      maxUsd: 50,
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('任何一项不合法都整体拒绝', () => {
    for (const search of [
      'page=0',
      'page=1.5',
      'size=30',
      'type=consume',
      'source=Alipay!',
      `q=${'x'.repeat(65)}`,
      'min=-1',
      'max=abc',
      'min=10&max=5',
      'from=2026-02-30',
      'from=2026-09-30&to=2026-09-01',
    ]) {
      expect(parseLedgerQuery(new URLSearchParams(search)), search).toBeNull();
    }
  });

  it('后端地址只带填了的条件，有日期才带时区', () => {
    expect(ledgerPath(BASE_QUERY)).toBe('/user/balance/ledger?page=1&page_size=20');
    const path = ledgerPath({
      ...BASE_QUERY,
      type: 'refund',
      query: 'sub2',
      minUsd: 0,
      from: '2026-09-01',
      to: '2026-09-30',
    });
    const params = new URL(path, 'http://x').searchParams;
    expect(params.get('type')).toBe('refund');
    expect(params.get('q')).toBe('sub2');
    expect(params.get('min_amount')).toBe('0');
    expect(params.has('max_amount')).toBe(false);
    expect(params.get('start_date')).toBe('2026-09-01');
    expect(params.get('end_date')).toBe('2026-09-30');
    expect(params.get('timezone')).toBe('Asia/Shanghai');
  });

  it('浏览器端的查询参数与官网的校验对得上', () => {
    const query: LedgerQuery = {
      ...BASE_QUERY,
      page: 3,
      source: 'wxpay',
      maxUsd: 20,
      to: '2026-10-04',
    };
    expect(parseLedgerQuery(ledgerSearchParams(query))).toEqual(query);
  });
});

describe('账单页：后端结果的转换', () => {
  it('余额卡缺任何一个数字都当取不到', () => {
    const raw = {
      balance: 131.2,
      total_recharged: 2.8,
      total_bonus: 0,
      total_consumed: 15.0864,
      recent_consumed: 15.0864,
      recent_days: 30,
    };
    expect(toBalanceSummary(raw)).toEqual({
      balanceUsd: 131.2,
      rechargedUsd: 2.8,
      bonusUsd: 0,
      consumedUsd: 15.0864,
      recentConsumedUsd: 15.0864,
      recentDays: 30,
    });
    expect(toBalanceSummary({ ...raw, total_bonus: null })).toBeNull();
    expect(toBalanceSummary(null)).toBeNull();
  });

  it('流水：认不出的行整行丢掉，其余换成页面用的形状', () => {
    const page = toLedgerPage({
      items: [
        {
          id: 'rc_1',
          type: 'recharge',
          source: 'alipay',
          amount: 2.8,
          balance_after: 131.2,
          reference: 'sub2_20260927i7leCzsB',
          note: '',
          pay_amount: 20.4,
          created_at: '2026-09-27T14:47:37.939053+08:00',
        },
        {
          id: 'rc_2',
          type: 'consume',
          amount: -1,
          balance_after: 1,
          created_at: '2026-09-27T00:00:00Z',
        },
        {
          id: 'rc_3',
          type: 'admin',
          amount: 'x',
          balance_after: 1,
          created_at: '2026-09-27T00:00:00Z',
        },
      ],
      total: 3,
      page: 1,
      page_size: 20,
      pages: 1,
      sources: ['alipay', 7],
    });
    expect(page).not.toBeNull();
    expect(page?.items).toEqual([
      {
        id: 'rc_1',
        type: 'recharge',
        source: 'alipay',
        amountUsd: 2.8,
        balanceAfterUsd: 131.2,
        reference: 'sub2_20260927i7leCzsB',
        note: '',
        ts: Date.parse('2026-09-27T06:47:37.939Z'),
      },
    ]);
    expect(page?.total).toBe(3);
    expect(page?.sources).toEqual(['alipay']);
    expect(toLedgerPage({ items: [] })).toBeNull();
  });

  it('兑换码原样提交（区分大小写），兑换结果与错误归类', () => {
    expect(parseRedeemCode({ code: '  PAY-7-43600 ' })).toBe('PAY-7-43600');
    expect(parseRedeemCode({ code: 'a1b2c3d4e5f6' })).toBe('a1b2c3d4e5f6');
    expect(parseRedeemCode({ code: '   ' })).toBeNull();
    expect(parseRedeemCode({ code: 'x'.repeat(65) })).toBeNull();
    expect(parseRedeemCode({})).toBeNull();
    expect(toRedeemResult({ type: 'balance', value: 10, code: 'x' })).toEqual({
      type: 'balance',
      value: 10,
    });
    expect(toRedeemResult({ type: 'balance' })).toBeNull();
    expect(redeemErrorFor(backendError(404, 'REDEEM_CODE_NOT_FOUND'))).toBe('not_found');
    expect(redeemErrorFor(backendError(409, 'REDEEM_CODE_USED'))).toBe('used');
    expect(redeemErrorFor(backendError(409, 'REDEEM_CODE_EXPIRED'))).toBe('expired');
    expect(redeemErrorFor(backendError(409, 'REDEEM_CODE_LOCKED'))).toBe('busy');
    expect(redeemErrorFor(backendError(429, 'REDEEM_RATE_LIMITED'))).toBe('too_many');
    expect(redeemErrorFor(backendError(429, ''))).toBe('too_many');
    expect(redeemErrorFor(backendError(500, 'INTERNAL'))).toBe('unavailable');
  });
});

describe('账单页：余额卡与交易记录的计算', () => {
  it('日均按最近 30 天算，可用天数向下取整；最近没有消耗时算不出', () => {
    expect(balanceOutlook(summary())).toEqual({ dailyAvgUsd: 0.5, runwayDays: 262 });
    expect(balanceOutlook(summary({ recentConsumedUsd: 0 }))).toEqual({
      dailyAvgUsd: 0,
      runwayDays: null,
    });
  });

  it('余额低于 US$1 或撑不过 3 天算偏低', () => {
    expect(isLowBalance(summary())).toBe(false);
    expect(isLowBalance(summary({ balanceUsd: 0.5, recentConsumedUsd: 0 }))).toBe(true);
    // 日均 2 美元，5 美元只够两天
    expect(isLowBalance(summary({ balanceUsd: 5, recentConsumedUsd: 60 }))).toBe(true);
    expect(isLowBalance(summary({ balanceUsd: 7, recentConsumedUsd: 60 }))).toBe(false);
  });

  it('按月翻：跨年、月末与「本月只到今天」', () => {
    expect(yearMonthOf('2026-09-04')).toEqual({ year: 2026, month: 9 });
    expect(shiftYearMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftYearMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(monthRangeOf({ year: 2026, month: 9 }, '2026-10-04')).toEqual({
      preset: null,
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(monthRangeOf({ year: 2028, month: 2 }, '2028-12-31').to).toBe('2028-02-29');
    expect(monthRangeOf({ year: 2026, month: 10 }, '2026-10-04').to).toBe('2026-10-04');
    expect(isCurrentOrLaterMonth({ year: 2026, month: 10 }, '2026-10-04')).toBe(true);
    expect(isCurrentOrLaterMonth({ year: 2026, month: 9 }, '2026-10-04')).toBe(false);
  });

  it('金额框：负数与非数字不筛，最小最大填反了自动对调', () => {
    expect(parseAmountFilter('')).toBeNull();
    expect(parseAmountFilter('-3')).toBeNull();
    expect(parseAmountFilter('abc')).toBeNull();
    expect(parseAmountFilter('0')).toBe(0);
    expect(amountRange('50', '10')).toEqual({ min: 10, max: 50 });
    expect(amountRange('5', '')).toEqual({ min: 5, max: null });
  });

  it('查询身份：任何一项变了都不同', () => {
    const key = ledgerQueryKey(BASE_QUERY);
    expect(ledgerQueryKey({ ...BASE_QUERY })).toBe(key);
    expect(ledgerQueryKey({ ...BASE_QUERY, page: 2 })).not.toBe(key);
    expect(ledgerQueryKey({ ...BASE_QUERY, minUsd: 0 })).not.toBe(key);
    expect(ledgerQueryKey({ ...BASE_QUERY, to: '2026-10-04' })).not.toBe(key);
  });
});
