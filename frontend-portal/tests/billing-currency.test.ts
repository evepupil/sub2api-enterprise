import { describe, expect, it } from 'vitest';
import { parseBillingConfig, parsePaymentOrder } from '../src/features/billing/adapter';
import { calculatePaymentTotal, currencyFractionDigits } from '../src/features/billing/validation';

function billingConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    enabled: true,
    balance_disabled: false,
    min_amount: 0,
    max_amount: 0,
    balance_recharge_multiplier: 1,
    ...overrides,
  };
}

function checkoutInfo(
  methods: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    recharge_fee_rate: 3,
    methods,
    ...overrides,
  };
}

function paymentMethod(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currency: 'CNY',
    single_min: 0,
    single_max: 0,
    daily_limit: 0,
    fee_rate: 0,
    available: true,
    ...overrides,
  };
}

describe('billing currency calculations', () => {
  it('uses the backend currency fraction-digit table', () => {
    expect(currencyFractionDigits('CNY')).toBe(2);
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(currencyFractionDigits('ISK')).toBe(0);
    expect(currencyFractionDigits('UGX')).toBe(0);
    expect(currencyFractionDigits('KWD')).toBe(3);
    expect(currencyFractionDigits('kwd')).toBe(3);
    expect(currencyFractionDigits('invalid')).toBe(2);
  });

  it('rounds the fee upward to the payment currency minimum unit', () => {
    expect(calculatePaymentTotal(1, 0.3, 'CNY')).toBe(1.01);
    expect(calculatePaymentTotal(100, 2, 'CNY')).toBe(102);
    expect(calculatePaymentTotal(100, 0.3, 'JPY')).toBe(101);
    expect(calculatePaymentTotal(1, 0.3, 'KWD')).toBe(1.003);
    expect(calculatePaymentTotal(0.1, 0.1, 'CNY')).toBe(0.11);
    expect(calculatePaymentTotal(100, 0, 'CNY')).toBe(100);
  });

  it('uses checkout top-level recharge_fee_rate instead of the zero method fee_rate', () => {
    const parsed = parseBillingConfig(
      billingConfig({ recharge_fee_rate: 9 }),
      checkoutInfo({ card: paymentMethod({ fee_rate: 0 }) }, { recharge_fee_rate: 3 }),
    );

    expect(parsed.methods).toHaveLength(1);
    expect(parsed.methods[0]).toMatchObject({ id: 'card', feeRate: 3 });
  });

  it('falls back to config recharge_fee_rate only when checkout omits it', () => {
    const parsed = parseBillingConfig(
      billingConfig({ recharge_fee_rate: 4 }),
      checkoutInfo({ card: paymentMethod({ fee_rate: 0 }) }, { recharge_fee_rate: undefined }),
    );

    expect(parsed.methods[0]).toMatchObject({ feeRate: 4 });
  });

  it('keeps daily limits separate from daily remaining values', () => {
    const parsed = parseBillingConfig(
      billingConfig({ daily_limit: 100 }),
      checkoutInfo({
        card: paymentMethod({ daily_limit: 50 }),
        exhausted: paymentMethod({ daily_limit: 25, daily_remaining: 0 }),
      }),
    );

    expect(parsed).toMatchObject({ dailyLimit: 100 });
    expect(parsed.methods[0]).toMatchObject({ dailyLimit: 50, dailyRemaining: null });
    expect(parsed.methods[1]).toMatchObject({ dailyLimit: 25, dailyRemaining: 0 });
  });

  it('preserves zero as an unlimited daily limit and does not invent remaining quota', () => {
    const parsed = parseBillingConfig(
      billingConfig({ daily_limit: 0 }),
      checkoutInfo({ card: paymentMethod({ daily_limit: 0 }) }),
    );

    expect(parsed).toMatchObject({ dailyLimit: 0 });
    expect(parsed.methods[0]).toMatchObject({ dailyLimit: 0, dailyRemaining: null });
  });

  it('keeps an order amount as the already-accounted USD amount', () => {
    const order = parsePaymentOrder({
      id: 17,
      amount: 12.34,
      pay_amount: 100,
      currency: 'CNY',
      payment_type: 'card',
      out_trade_no: 'trade-17',
      status: 'COMPLETED',
      created_at: '2026-09-27T00:00:00Z',
      expires_at: '2026-09-27T01:00:00Z',
    });

    expect(order.amount).toBe(12.34);
    expect(order.payAmount).toBe(100);
  });
});
