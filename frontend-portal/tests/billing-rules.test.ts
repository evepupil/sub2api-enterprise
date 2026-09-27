/**
 * M3 余额与订单业务规则测试。
 *
 * 契约来源：.fleet/briefs/m23-billing-api.md、src/features/billing/types.ts、design/customer-console.md 第 3 节。
 * 请求全部用 mock，不发真实网络请求。
 *
 * 业务事实（任务书）：
 * - 金额必须正、有限、最多两位小数；综合全局 min/max、支付方式 min/max（0 = 不限）、
 *   日剩余（null = 不限，0 表示额度耗尽不可再充）、支付方式可用性与余额充值开关。
 * - 支付币种默认 CNY；后台配置为 USD 时保持 USD；实际支付金额 payAmount 不做汇率换算。
 * - pay_url / oauth.authorize_url 只接受 http(s) 且无 userinfo；非法 scheme / javascript / userinfo 拒绝；
 *   qr_code 是二维码内容，原样返回，不当作 URL 加载。
 * - 未知订单状态一律 UNKNOWN；只有 COMPLETED 表示到账；
 *   PENDING / PAID / RECHARGING 仍需轮询；EXPIRED / CANCELLED / FAILED 等终态不轮询。
 * - 写操作超时不能隐式重试创建订单。
 * - return_url 只允许本站当前 origin 的 /payment/result（旧 /console/billing 已不合法）；order_id 必须校验。
 * - 空订单列表合法。
 */

import { describe, expect, it } from 'vitest';

import type { ApiRequestOptions, ApiRequester } from '../src/features/auth/types';
import {
  hasPaymentEntry,
  normalizePaymentCurrency,
  parseBillingConfig,
  parseBillingReturnUrl,
  parseOrderPage,
  parsePaymentLaunch,
  parsePaymentMethod,
  parsePaymentOrder,
  paymentMethodDisplayName,
  safePaymentUrl,
} from '../src/features/billing/adapter';
import { createPaymentOrder, fetchBillingConfig, fetchOrders } from '../src/features/billing/api';
import type { BillingConfig, OrderStatus, PaymentMethod } from '../src/features/billing/types';
import {
  formatBillingMoney,
  isOrderCompleted,
  isOrderPending,
  orderStatusLabel,
  validateRechargeAmount,
} from '../src/features/billing/validation';

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

function method(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: 'alipay',
    name: '支付宝',
    currency: 'CNY',
    min: 0,
    max: 0,
    dailyRemaining: null,
    feeRate: 0,
    available: true,
    ...overrides,
  };
}

function config(overrides: Partial<BillingConfig> = {}): BillingConfig {
  return {
    enabled: true,
    balanceDisabled: false,
    min: 0,
    max: 0,
    multiplier: 1,
    methods: [],
    stripePublicKey: null,
    helpText: null,
    ...overrides,
  };
}

describe('validateRechargeAmount：格式与正数', () => {
  it('整数与最多两位小数通过', () => {
    expect(validateRechargeAmount('10', method(), config())).toEqual({ amount: 10, error: null });
    expect(validateRechargeAmount('10.5', method(), config())).toEqual({
      amount: 10.5,
      error: null,
    });
    expect(validateRechargeAmount('10.55', method(), config())).toEqual({
      amount: 10.55,
      error: null,
    });
  });

  it('前后空白会被忽略后解析', () => {
    expect(validateRechargeAmount(' 20 ', method(), config())).toEqual({ amount: 20, error: null });
  });

  it('空串、0、负数、NaN 都被拒绝，不猜成 0', () => {
    expect(validateRechargeAmount('', method(), config()).amount).toBeNull();
    expect(validateRechargeAmount('0', method(), config()).amount).toBeNull();
    expect(validateRechargeAmount('-5', method(), config()).amount).toBeNull();
    expect(validateRechargeAmount('NaN', method(), config()).amount).toBeNull();
  });

  it('超过两位小数、指数、非法字符被拒绝', () => {
    expect(validateRechargeAmount('10.555', method(), config()).amount).toBeNull();
    expect(validateRechargeAmount('1e3', method(), config()).amount).toBeNull();
    expect(validateRechargeAmount('10abc', method(), config()).amount).toBeNull();
    expect(validateRechargeAmount('.5', method(), config()).amount).toBeNull();
  });
});

describe('validateRechargeAmount：全局与方式上下限', () => {
  it('低于全局最小值被拒绝', () => {
    const result = validateRechargeAmount('5', method(), config({ min: 10 }));
    expect(result.amount).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('高于全局最大值被拒绝', () => {
    const result = validateRechargeAmount('500', method(), config({ max: 100 }));
    expect(result.amount).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('全局 0 表示不限，两端都放行', () => {
    expect(validateRechargeAmount('1', method(), config({ min: 0, max: 0 })).amount).toBe(1);
    expect(validateRechargeAmount('999999', method(), config({ min: 0, max: 0 })).amount).toBe(
      999999,
    );
  });

  it('低于支付方式最小值被拒绝', () => {
    expect(validateRechargeAmount('5', method({ min: 20 }), config()).amount).toBeNull();
  });

  it('高于支付方式最大值被拒绝', () => {
    expect(validateRechargeAmount('50', method({ max: 30 }), config()).amount).toBeNull();
  });

  it('支付方式 0 表示不限', () => {
    expect(validateRechargeAmount('5', method({ min: 0, max: 0 }), config()).amount).toBe(5);
  });

  it('全局与方式限制同时生效，取更严的一侧', () => {
    const result = validateRechargeAmount(
      '15',
      method({ min: 0, max: 10 }),
      config({ min: 0, max: 100 }),
    );
    expect(result.amount).toBeNull();
  });
});

describe('validateRechargeAmount：日剩余与开关', () => {
  it('dailyRemaining 为 null 表示不限', () => {
    expect(validateRechargeAmount('1000', method({ dailyRemaining: null }), config()).amount).toBe(
      1000,
    );
  });

  it('超过日剩余被拒绝', () => {
    expect(
      validateRechargeAmount('100', method({ dailyRemaining: 50 }), config()).amount,
    ).toBeNull();
  });

  it('恰好等于日剩余通过', () => {
    expect(validateRechargeAmount('50', method({ dailyRemaining: 50 }), config()).amount).toBe(50);
  });

  it('dailyRemaining 为 0 表示额度耗尽，任何金额都不能再充', () => {
    expect(validateRechargeAmount('1', method({ dailyRemaining: 0 }), config()).amount).toBeNull();
  });

  it('支付方式 available=false 时拒绝', () => {
    expect(validateRechargeAmount('10', method({ available: false }), config()).amount).toBeNull();
  });

  it('balanceDisabled 为 true 时拒绝，即使方式可用', () => {
    expect(
      validateRechargeAmount('10', method(), config({ balanceDisabled: true })).amount,
    ).toBeNull();
  });

  it('支付总开关 enabled=false 时拒绝任何金额充值', () => {
    const result = validateRechargeAmount('10', method(), config({ enabled: false }));
    expect(result.amount).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe('币种与金额展示', () => {
  it('缺失或非法币种回落到 CNY，不按模型 USD 单价推导', () => {
    expect(normalizePaymentCurrency(undefined)).toBe('CNY');
    expect(normalizePaymentCurrency('')).toBe('CNY');
    expect(normalizePaymentCurrency('US')).toBe('CNY');
  });

  it('合法三位币种原样大写', () => {
    expect(normalizePaymentCurrency('usd')).toBe('USD');
    expect(normalizePaymentCurrency(' eur ')).toBe('EUR');
  });

  it('parsePaymentMethod 保留后台 payment_type id 原值', () => {
    const parsed = parsePaymentMethod('wxpay_direct', { display_name: '微信支付' });
    expect(parsed.id).toBe('wxpay_direct');
    expect(parsed.name).toBe('微信支付');
  });

  it('display_name 缺失时回落到内置映射，再回落到原始 id', () => {
    expect(paymentMethodDisplayName('alipay')).toBe('支付宝');
    expect(paymentMethodDisplayName('stripe')).toBe('银行卡');
    expect(paymentMethodDisplayName('mystery')).toBe('mystery');
  });

  it('formatBillingMoney 沿用传入币种，不做换算', () => {
    const cny = formatBillingMoney(100, 'CNY');
    const usd = formatBillingMoney(100, 'USD');
    expect(cny).toContain('100');
    expect(usd).toContain('100');
    expect(cny).not.toBe(usd);
  });

  it('formatBillingMoney 对非法币种回落 CNY 而不返回空串', () => {
    const result = formatBillingMoney(10, 'NOT_A_CURRENCY');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('10');
  });
});

describe('订单状态语义', () => {
  it('仅 COMPLETED 视为到账', () => {
    expect(isOrderCompleted('COMPLETED')).toBe(true);
    for (const status of ['PENDING', 'PAID', 'RECHARGING', 'EXPIRED', 'CANCELLED'] as const) {
      expect(isOrderCompleted(status)).toBe(false);
    }
  });

  it('PENDING / PAID / RECHARGING 仍需轮询', () => {
    expect(isOrderPending('PENDING')).toBe(true);
    expect(isOrderPending('PAID')).toBe(true);
    expect(isOrderPending('RECHARGING')).toBe(true);
  });

  it('终态不再轮询', () => {
    for (const status of ['COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED', 'REFUNDED'] as const) {
      expect(isOrderPending(status)).toBe(false);
    }
  });

  it('每个冻结状态都有中文标签，UNKNOWN 明确标注', () => {
    const statuses: OrderStatus[] = [
      'PENDING',
      'PAID',
      'RECHARGING',
      'COMPLETED',
      'EXPIRED',
      'CANCELLED',
      'FAILED',
      'UNKNOWN',
    ];
    for (const status of statuses) {
      expect(orderStatusLabel(status).length).toBeGreaterThan(0);
    }
    expect(orderStatusLabel('UNKNOWN')).not.toBe(orderStatusLabel('COMPLETED'));
  });
});

describe('parseBillingConfig', () => {
  it('后端真实字段 enabled=false 时返回禁用配置', () => {
    const parsed = parseBillingConfig({ enabled: false, min_amount: 5, max_amount: 100 });
    expect(parsed.enabled).toBe(false);
    expect(parsed.min).toBe(5);
    expect(parsed.max).toBe(100);
    expect(parsed.methods).toEqual([]);
  });

  it('旧字段 payment_enabled 不再是开关，enabled 才是权威字段', () => {
    // 后端已改为返回 enabled；遗留的 payment_enabled 不应被当成开关。
    const parsed = parseBillingConfig({ enabled: false, payment_enabled: true });
    expect(parsed.enabled).toBe(false);
  });

  it('开启时解析全局限额与支付方式', () => {
    const parsed = parseBillingConfig(
      { enabled: true, min_amount: 10, max_amount: 500, balance_disabled: false },
      {
        methods: {
          alipay: {
            single_min: 10,
            single_max: 200,
            daily_limit: 0,
            daily_remaining: 100,
            fee_rate: 0.01,
            available: true,
          },
        },
      },
    );
    expect(parsed.enabled).toBe(true);
    expect(parsed.min).toBe(10);
    expect(parsed.max).toBe(500);
    expect(parsed.methods).toHaveLength(1);
    expect(parsed.methods[0]?.id).toBe('alipay');
    expect(parsed.methods[0]?.dailyRemaining).toBe(100);
    expect(parsed.methods[0]?.feeRate).toBe(0.01);
  });

  it('未开启时即使给了 checkout 也不解析支付方式', () => {
    const parsed = parseBillingConfig(
      { enabled: false },
      { methods: { alipay: { single_min: 1, single_max: 2, available: true } } },
    );
    expect(parsed.methods).toEqual([]);
  });

  it('支付方式缺字段按 0（不限），available 缺失视为可用', () => {
    const parsed = parseBillingConfig({ enabled: true }, { methods: { wxpay: {} } });
    expect(parsed.methods[0]).toMatchObject({ min: 0, max: 0, feeRate: 0, available: true });
  });

  it('daily_remaining 缺失为 null（不限）', () => {
    const parsed = parseBillingConfig({ enabled: true }, { methods: { wxpay: {} } });
    expect(parsed.methods[0]?.dailyRemaining).toBeNull();
  });

  it('币种缺失回落 CNY，配置 USD 时保持 USD', () => {
    const cny = parseBillingConfig({ enabled: true }, { methods: { wxpay: {} } });
    expect(cny.methods[0]?.currency).toBe('CNY');
    const usd = parseBillingConfig({ enabled: true }, { methods: { stripe: { currency: 'USD' } } });
    expect(usd.methods[0]?.currency).toBe('USD');
  });
});

describe('parsePaymentOrder：严格数字与未知状态', () => {
  function order(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 1,
      amount: 100,
      pay_amount: 100,
      currency: 'CNY',
      payment_type: 'alipay',
      out_trade_no: 'T-1',
      status: 'PENDING',
      created_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-01T00:30:00Z',
      completed_at: null,
      ...overrides,
    };
  }

  it('正常订单解析出冻结字段', () => {
    const parsed = parsePaymentOrder(order());
    expect(parsed).toMatchObject({
      id: 1,
      amount: 100,
      payAmount: 100,
      currency: 'CNY',
      method: 'alipay',
      tradeNumber: 'T-1',
      status: 'PENDING',
      completedAt: null,
    });
  });

  it('未知状态归为 UNKNOWN', () => {
    expect(parsePaymentOrder(order({ status: 'WEIRD_STATE' })).status).toBe('UNKNOWN');
    expect(parsePaymentOrder(order({ status: null })).status).toBe('UNKNOWN');
  });

  it('已知状态保留原值', () => {
    expect(parsePaymentOrder(order({ status: 'COMPLETED' })).status).toBe('COMPLETED');
    expect(parsePaymentOrder(order({ status: 'RECHARGING' })).status).toBe('RECHARGING');
  });

  it('payAmount 保留后端值，不做换算', () => {
    expect(parsePaymentOrder(order({ amount: 100, pay_amount: 102.5 })).payAmount).toBe(102.5);
  });

  it('金额缺失或 null 抛错，不猜 0', () => {
    const { amount, ...withoutAmount } = order();
    void amount;
    expect(() => parsePaymentOrder(withoutAmount)).toThrow();
    expect(() => parsePaymentOrder(order({ amount: null }))).toThrow();
    expect(() => parsePaymentOrder(order({ pay_amount: Number.NaN }))).toThrow();
    expect(() => parsePaymentOrder(order({ amount: -1 }))).toThrow();
  });

  it('币种缺失回落 CNY', () => {
    const { currency, ...withoutCurrency } = order();
    void currency;
    expect(parsePaymentOrder(withoutCurrency).currency).toBe('CNY');
  });
});

describe('parseOrderPage：空订单合法', () => {
  it('空列表与零 total 合法', () => {
    const parsed = parseOrderPage(
      { items: [], total: 0, page: 1, page_size: 20 },
      { page: 1, pageSize: 20 },
    );
    expect(parsed.items).toEqual([]);
    expect(parsed.total).toBe(0);
    expect(parsed.pages).toBe(1);
  });

  it('缺失分页字段回落到请求参数', () => {
    const parsed = parseOrderPage({ items: [] }, { page: 3, pageSize: 10 });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(10);
  });

  it('items 非数组抛错', () => {
    expect(() => parseOrderPage({ items: null }, { page: 1, pageSize: 10 })).toThrow();
  });
});

describe('支付入口安全（payUrl / qrCode / oauth）', () => {
  it('https 且无 userinfo 的 pay_url 通过', () => {
    expect(safePaymentUrl('https://pay.example.com/checkout?id=1')).toBe(
      'https://pay.example.com/checkout?id=1',
    );
  });

  it('javascript: 与 data: 等非法 scheme 被拒绝', () => {
    expect(safePaymentUrl('javascript:alert(1)')).toBeNull();
    expect(safePaymentUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safePaymentUrl('file:///etc/passwd')).toBeNull();
  });

  it('带 userinfo 的 URL 被拒绝', () => {
    expect(safePaymentUrl('https://user:pass@pay.example.com/x')).toBeNull();
    expect(safePaymentUrl('https://user@pay.example.com/x')).toBeNull();
  });

  it('非字符串或空串返回 null', () => {
    expect(safePaymentUrl(undefined)).toBeNull();
    expect(safePaymentUrl('')).toBeNull();
    expect(safePaymentUrl(123)).toBeNull();
  });

  it('parsePaymentLaunch 拒绝非法 pay_url 与 oauth.authorize_url', () => {
    const parsed = parsePaymentLaunch({
      order_id: 1,
      amount: 10,
      pay_amount: 10,
      currency: 'CNY',
      expires_at: '2026-01-01T00:30:00Z',
      pay_url: 'javascript:alert(1)',
      oauth: { authorize_url: 'https://user:pass@oauth.example.com/a' },
    });
    expect(parsed.payUrl).toBeNull();
    expect(parsed.oauthUrl).toBeNull();
  });

  it('qr_code 是二维码内容，原样返回且不要求是 URL', () => {
    const parsed = parsePaymentLaunch({
      order_id: 1,
      amount: 10,
      pay_amount: 10,
      expires_at: '2026-01-01T00:30:00Z',
      qr_code: 'weixin://wxpay/bizpayurl?pr=abc',
    });
    expect(parsed.qrCode).toBe('weixin://wxpay/bizpayurl?pr=abc');
    expect(parsed.payUrl).toBeNull();
  });

  it('jsapi 只保留白名单字符串键', () => {
    const parsed = parsePaymentLaunch({
      order_id: 1,
      amount: 10,
      pay_amount: 10,
      expires_at: '2026-01-01T00:30:00Z',
      jsapi_payload: {
        appId: 'wx1',
        timeStamp: '123',
        nonceStr: 'n',
        package: 'prepay_id=x',
        signType: 'RSA',
        paySign: 'sig',
        extraSecret: 'leak',
      },
    });
    expect(parsed.jsapi).toEqual({
      appId: 'wx1',
      timeStamp: '123',
      nonceStr: 'n',
      package: 'prepay_id=x',
      signType: 'RSA',
      paySign: 'sig',
    });
    expect(parsed.jsapi).not.toHaveProperty('extraSecret');
  });

  it('没有任何入口时 hasPaymentEntry 为 false（UI 提示稍后重试，不伪造支付）', () => {
    const parsed = parsePaymentLaunch({
      order_id: 1,
      amount: 10,
      pay_amount: 10,
      expires_at: '2026-01-01T00:30:00Z',
    });
    expect(parsed.payUrl).toBeNull();
    expect(parsed.qrCode).toBeNull();
    expect(parsed.clientSecret).toBeNull();
    expect(parsed.oauthUrl).toBeNull();
    expect(parsed.jsapi).toBeNull();
    expect(hasPaymentEntry(parsed)).toBe(false);
  });

  it('order_id 缺失或非法时抛错', () => {
    expect(() =>
      parsePaymentLaunch({
        amount: 10,
        pay_amount: 10,
        expires_at: '2026-01-01T00:30:00Z',
      }),
    ).toThrow();
    expect(() =>
      parsePaymentLaunch({
        order_id: null,
        amount: 10,
        pay_amount: 10,
        expires_at: '2026-01-01T00:30:00Z',
      }),
    ).toThrow();
    expect(() =>
      parsePaymentLaunch({
        order_id: Number.NaN,
        amount: 10,
        pay_amount: 10,
        expires_at: '2026-01-01T00:30:00Z',
      }),
    ).toThrow();
  });
});

describe('parseBillingReturnUrl：本站 /payment/result', () => {
  const ORIGIN = 'https://portal.example.com';

  it('本站 /payment/result 通过，允许查询参数', () => {
    expect(parseBillingReturnUrl('https://portal.example.com/payment/result', ORIGIN)).toBe(
      'https://portal.example.com/payment/result',
    );
    expect(
      parseBillingReturnUrl('https://portal.example.com/payment/result?order_id=1', ORIGIN),
    ).toContain('order_id=1');
  });

  it('跨域被拒绝', () => {
    expect(() =>
      parseBillingReturnUrl('https://evil.example.com/payment/result', ORIGIN),
    ).toThrow();
  });

  it('旧路径 /console/billing 不再合法，被拒绝', () => {
    expect(() =>
      parseBillingReturnUrl('https://portal.example.com/console/billing', ORIGIN),
    ).toThrow();
  });

  it('路径不是 /payment/result 被拒绝', () => {
    expect(() =>
      parseBillingReturnUrl('https://portal.example.com/console/other', ORIGIN),
    ).toThrow();
    expect(() => parseBillingReturnUrl('https://portal.example.com/', ORIGIN)).toThrow();
  });

  it('非 http(s) scheme 被拒绝', () => {
    expect(() => parseBillingReturnUrl('javascript:alert(1)', ORIGIN)).toThrow();
    expect(() =>
      parseBillingReturnUrl('ftp://portal.example.com/payment/result', ORIGIN),
    ).toThrow();
  });

  it('带 userinfo 被拒绝', () => {
    expect(() =>
      parseBillingReturnUrl('https://user:pass@portal.example.com/payment/result', ORIGIN),
    ).toThrow();
  });

  it('空串或非字符串被拒绝', () => {
    expect(() => parseBillingReturnUrl('', ORIGIN)).toThrow();
    expect(() => parseBillingReturnUrl(undefined, ORIGIN)).toThrow();
  });
});

describe('billing api 请求边界（mock，无真实请求）', () => {
  it('未开启支付时只请求 /payment/config，不请求 checkout-info', async () => {
    const { request, calls } = makeRequester((path) =>
      path === '/payment/config' ? { enabled: false } : {},
    );
    const result = await fetchBillingConfig(request);
    expect(result.enabled).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/payment/config');
  });

  it('enabled=true 时并行请求 config 与 checkout-info，并读取 checkout 的 methods', async () => {
    const { request, calls } = makeRequester((path) =>
      path === '/payment/config'
        ? { enabled: true, min_amount: 10 }
        : {
            methods: {
              alipay: { single_min: 10, single_max: 100, available: true },
              wxpay: { single_min: 1, single_max: 50, available: false },
            },
          },
    );
    const result = await fetchBillingConfig(request);
    expect(result.enabled).toBe(true);
    expect(calls.map((call) => call.path).sort()).toEqual([
      '/payment/checkout-info',
      '/payment/config',
    ]);
    expect(result.methods.map((entry) => entry.id).sort()).toEqual(['alipay', 'wxpay']);
    expect(result.methods.find((entry) => entry.id === 'alipay')?.available).toBe(true);
  });

  it('fetchOrders 请求 /payment/orders/my 并带分页与状态', async () => {
    const { request, calls } = makeRequester(() => ({ items: [], total: 0 }));
    await fetchOrders(request, { page: 1, pageSize: 20, status: 'PENDING' });
    const call = calls[0];
    expect(call?.options?.method).toBe('GET');
    const url = new URL(call?.path ?? '', 'https://portal.example.com');
    expect(url.pathname).toBe('/payment/orders/my');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('status')).toBe('PENDING');
  });

  it('createPaymentOrder 提交固定业务字段与幂等键', async () => {
    const { request, calls } = makeRequester(() => ({
      order_id: 1,
      amount: 100,
      pay_amount: 100,
      currency: 'CNY',
      expires_at: '2026-01-01T00:30:00Z',
      pay_url: 'https://pay.example.com/x',
    }));
    await createPaymentOrder(request, {
      amount: 100,
      methodId: 'alipay',
      returnUrl: 'https://portal.example.com/payment/result',
      isMobile: false,
    });
    const call = calls[0];
    expect(call?.path).toBe('/payment/orders');
    expect(call?.options?.method).toBe('POST');
    const body = call?.options?.body as Record<string, unknown>;
    expect(body.amount).toBe(100);
    expect(body.payment_type).toBe('alipay');
    expect(body.order_type).toBe('balance');
    expect(body.payment_source).toBe('hosted_redirect');
    expect(body.is_mobile).toBe(false);
    expect(call?.options?.headers?.['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('createPaymentOrder 超时不隐式重试，只发一次请求', async () => {
    const { request, calls } = makeRequester(() => {
      throw new Error('timeout');
    });
    await expect(
      createPaymentOrder(request, {
        amount: 100,
        methodId: 'alipay',
        returnUrl: 'https://portal.example.com/payment/result',
      }),
    ).rejects.toThrow('timeout');
    expect(calls).toHaveLength(1);
  });

  it('createPaymentOrder 在非法 returnUrl 时发请求前拒绝', async () => {
    const { request, calls } = makeRequester(() => ({}));
    await expect(
      createPaymentOrder(request, {
        amount: 100,
        methodId: 'alipay',
        returnUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('createPaymentOrder 拒绝非法金额与空支付方式，不发请求', async () => {
    const { request, calls } = makeRequester(() => ({}));
    await expect(
      createPaymentOrder(request, {
        amount: 0,
        methodId: 'alipay',
        returnUrl: 'https://portal.example.com/payment/result',
      }),
    ).rejects.toThrow();
    await expect(
      createPaymentOrder(request, {
        amount: Number.NaN,
        methodId: 'alipay',
        returnUrl: 'https://portal.example.com/payment/result',
      }),
    ).rejects.toThrow();
    await expect(
      createPaymentOrder(request, {
        amount: 100,
        methodId: '   ',
        returnUrl: 'https://portal.example.com/payment/result',
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
