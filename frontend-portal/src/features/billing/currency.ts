/**
 * 支付币种精度与应付金额计算（纯函数，无网络、无副作用、无第三方依赖）。
 *
 * 契约来源：backend/internal/payment/currency.go、backend/internal/payment/fee.go
 * 与 backend/internal/service/payment_amounts.go。
 *
 * 边界：
 * - 币种精度与后端 CurrencyMaxFractionDigits 一致：JPY/ISK/UGX 等 0 位，
 *   KWD 等 3 位，其余（含非法/未知币种）2 位。
 * - 手续费按后端 CalculatePayAmountForCurrency 计算：amount × feeRate / 100，
 *   向上取整到该币种最小支付单位；feeRate <= 0 时不收手续费。
 * - 全程用十进制字符串 + BigInt 计算，避免二进制浮点把手续费多进 1 分钱
 *   （例如 1 × 2% 必须是 1.02，而不是 1.03）。
 * - 仅做展示预估，最终应付金额以后端订单返回的 pay_amount 为准。
 */

/** 0 位小数币种（对应后端 zeroDecimalAmountUnit / stripeLegacyZeroAmount）。 */
const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set<string>([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
  'ISK',
  'UGX',
]);

/** 3 位小数币种（对应后端 threeDecimalAmountUnit）。 */
const THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set<string>([
  'BHD',
  'IQD',
  'JOD',
  'KWD',
  'LYD',
  'OMR',
  'TND',
]);

/** 默认 2 位小数（对应后端 twoDecimalAmountUnit）。 */
const DEFAULT_FRACTION_DIGITS = 2;

/**
 * 支付币种允许展示和输入的小数位数。
 * 非法或未知币种回落到 2 位，与后端 paymentCurrencyAmountUnitFor 一致。
 */
export function currencyFractionDigits(currency: string): number {
  const normalized = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) {
    return 0;
  }
  if (THREE_DECIMAL_CURRENCIES.has(normalized)) {
    return 3;
  }
  return DEFAULT_FRACTION_DIGITS;
}

/** 以 10 为底的幂，带缓存，指数为非负整数。 */
const POW10: bigint[] = [1n];

function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error('invalid decimal exponent');
  }
  while (POW10.length <= exponent) {
    POW10.push(POW10[POW10.length - 1]! * 10n);
  }
  return POW10[exponent]!;
}

/** 十进制表示：value = int / 10^scale。 */
interface Decimal {
  int: bigint;
  scale: number;
}

/**
 * 把有限 number 转成精确十进制表示。
 * 使用 number 自身的十进制字符串，指数形式（如 1e-7）也会被展开，不引入浮点误差。
 */
function decimalFromNumber(value: number): Decimal | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const text = value.toString();
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (match === null) {
    return null;
  }
  const sign = match[1] === '-' ? -1n : 1n;
  const intPart = match[2] ?? '';
  const fracPart = match[3] ?? '';
  const exponent = match[4] === undefined ? 0 : Number(match[4]);
  const digits = intPart + fracPart;
  let int = BigInt(digits) * sign;
  let scale = fracPart.length - exponent;
  if (scale < 0) {
    int *= pow10(-scale);
    scale = 0;
  }
  return { int, scale };
}

/** 放大到指定小数位并向上取整（远离零），返回以 10^digits 为单位的整数。 */
function ceilToMinor(dec: Decimal, digits: number): bigint {
  if (dec.scale <= digits) {
    return dec.int * pow10(digits - dec.scale);
  }
  const divisor = pow10(dec.scale - digits);
  const quotient = dec.int / divisor;
  const remainder = dec.int % divisor;
  if (remainder === 0n) {
    return quotient;
  }
  return dec.int > 0n ? quotient + 1n : quotient - 1n;
}

/** 放大到指定小数位并按四舍五入（远离零）取整，与后端 decimal.Round 一致。 */
function roundHalfUpToMinor(dec: Decimal, digits: number): bigint {
  if (dec.scale <= digits) {
    return dec.int * pow10(digits - dec.scale);
  }
  const divisor = pow10(dec.scale - digits);
  const quotient = dec.int / divisor;
  const remainder = dec.int % divisor;
  const doubled = (remainder < 0n ? -remainder : remainder) * 2n;
  if (doubled >= divisor) {
    return dec.int > 0n ? quotient + 1n : quotient - 1n;
  }
  return quotient;
}

/**
 * 预估应付金额：amount + 手续费，手续费 = amount × feeRate / 100 向上取整到
 * 该币种最小支付单位（对应后端 CalculatePayAmountForCurrency）。
 *
 * - feeRate <= 0、NaN 或 Infinity 时不收手续费，金额按币种精度四舍五入；
 * - amount 非有限数时返回 NaN，绝不猜成 0；
 * - 结果只用于展示，最终以后端 pay_amount 为准。
 */
export function calculatePaymentTotal(amount: number, feeRate: number, currency: string): number {
  const digits = currencyFractionDigits(currency);
  const amountDec = decimalFromNumber(amount);
  if (amountDec === null) {
    return Number.NaN;
  }
  const amountMinor = roundHalfUpToMinor(amountDec, digits);

  let feeMinor = 0n;
  const rateDec =
    typeof feeRate === 'number' && Number.isFinite(feeRate) && feeRate > 0
      ? decimalFromNumber(feeRate)
      : null;
  if (rateDec !== null) {
    // amount × feeRate / 100：乘法的 scale 相加，除以 100 再补 2 位。
    const feeDec: Decimal = {
      int: amountDec.int * rateDec.int,
      scale: amountDec.scale + rateDec.scale + 2,
    };
    feeMinor = ceilToMinor(feeDec, digits);
  }

  return Number(amountMinor + feeMinor) / Number(pow10(digits));
}
