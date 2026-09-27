export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'RECHARGING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUNDING'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REFUND_FAILED'
  | 'UNKNOWN';
export interface PaymentMethod {
  id: string;
  name: string;
  currency: string;
  min: number;
  max: number;
  dailyRemaining: number | null;
  /** 后台配置的每日累计上限（0 = 不限）；这是上限，不是剩余额度。 */
  dailyLimit?: number;
  /** 实际充值费率（百分比），来自 checkout/config 的 recharge_fee_rate。 */
  feeRate: number;
  available: boolean;
}
export interface BillingConfig {
  enabled: boolean;
  balanceDisabled: boolean;
  min: number;
  max: number;
  multiplier: number;
  /** 后台配置的每日累计充值上限（0 = 不限）；不是剩余额度。 */
  dailyLimit?: number;
  methods: PaymentMethod[];
  stripePublicKey: string | null;
  helpText: string | null;
}
export interface PaymentOrder {
  id: number;
  amount: number;
  payAmount: number;
  currency: string;
  method: string;
  tradeNumber: string;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}
export interface PaymentLaunch {
  orderId: number;
  amount: number;
  payAmount: number;
  currency: string;
  expiresAt: string;
  payUrl: string | null;
  qrCode: string | null;
  clientSecret: string | null;
  intentId: string | null;
  paymentType: string;
  paymentEnvironment: string | null;
  countryCode: string | null;
  oauthUrl: string | null;
  jsapi: Record<string, string> | null;
}
