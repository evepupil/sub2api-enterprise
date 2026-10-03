import type {
  BillingMode,
  ChannelModel,
  ConsoleChannel,
  PriceTier,
  TimeWindow,
  TokenRates,
} from '@/lib/console/live/models-types';

/**
 * 后端「模型广场」（/api/v1/model-plaza）→ 控制台模型页用的分组与模型。纯函数，单测锁住。
 * 口径与后端计费、旧版广场页一致：实付价 = 单价 × 生效倍率（专属倍率优先；生图模型在开了
 * 「生图独立倍率」时用生图倍率），官方价不乘倍率；长上下文分档没给绝对价时按「基础价 × 档位倍率」算。
 */

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const list = (value: unknown): RawRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const notNull = <T>(value: T | null): value is T => value !== null;

const BILLING_MODES: readonly BillingMode[] = ['token', 'per_request', 'image', 'video'];

function billingOf(value: unknown): BillingMode {
  return BILLING_MODES.find((mode) => mode === value) ?? 'token';
}

/** 档位单价：给了绝对价用绝对价，否则基础价 × 档位倍率 */
function tierPrice(absolute: unknown, multiplier: unknown, base: number | null): number | null {
  const price = num(absolute);
  if (price !== null) return price;
  return base === null ? null : base * (num(multiplier) ?? 1);
}

function toTiers(raw: unknown, base: TokenRates): PriceTier[] {
  return list(raw)
    .map((tier) => ({
      minTokens: num(tier.min_tokens) ?? 0,
      maxTokens: num(tier.max_tokens),
      input: tierPrice(tier.input_price, tier.input_multiplier, base.input),
      output: tierPrice(tier.output_price, tier.output_multiplier, base.output),
    }))
    .sort((a, b) => a.minTokens - b.minTokens);
}

/** 「08:30:00」写成「08:30」 */
const clock = (value: string) => value.replace(/^(\d{2}:\d{2}):00$/, '$1');

function toWindow(start: unknown, end: unknown, multiplier: unknown): TimeWindow | null {
  const rate = num(multiplier);
  if (typeof start !== 'string' || typeof end !== 'string' || !start || !end || rate === null) {
    return null;
  }
  return { start: clock(start), end: clock(end), multiplier: rate };
}

function toModel(raw: RawRecord): ChannelModel | null {
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;
  const pricing = isRecord(raw.pricing) ? raw.pricing : {};
  const billing = billingOf(pricing.billing_mode);
  const base: TokenRates = { input: num(pricing.input_price), output: num(pricing.output_price) };

  // 按次 / 按张：分档（如分辨率档）里配了按次价的取最低一档，否则取单一的按次价
  const requestTiers = list(pricing.intervals)
    .map((tier) => num(tier.per_request_price))
    .filter(notNull);
  const perRequest =
    requestTiers.length > 0 ? Math.min(...requestTiers) : num(pricing.per_request_price);

  const official = isRecord(raw.official_pricing)
    ? {
        input: num(raw.official_pricing.input_price),
        output: num(raw.official_pricing.output_price),
      }
    : null;

  const time = isRecord(raw.time_pricing) ? raw.time_pricing : null;
  const windows = time
    ? list(time.periods)
        .map((period) => toWindow(period.start_time, period.end_time, period.multiplier))
        .filter(notNull)
    : [];

  return {
    id: raw.name,
    platform: typeof raw.platform === 'string' ? raw.platform : '',
    billing,
    base,
    tiers: billing === 'token' ? toTiers(pricing.intervals, base) : [],
    perRequest: billing === 'token' ? null : perRequest,
    perRequestTiered: billing !== 'token' && requestTiers.length > 1,
    official: official && (official.input !== null || official.output !== null) ? official : null,
    timePricing:
      time && windows.length > 0 ? { weekdaysOnly: time.weekdays_only === true, windows } : null,
  };
}

function toChannel(raw: RawRecord): ConsoleChannel | null {
  const id = num(raw.id);
  if (id === null || typeof raw.name !== 'string') return null;
  const defaultRate = num(raw.rate_multiplier) ?? 1;
  return {
    id: String(id),
    name: raw.name,
    rate: num(raw.user_rate_multiplier) ?? defaultRate,
    defaultRate,
    imageRate: raw.image_rate_independent === true ? (num(raw.image_rate_multiplier) ?? 1) : null,
    longContext: raw.long_context_pricing_enabled === true,
    peak:
      raw.peak_rate_enabled === true
        ? toWindow(raw.peak_start, raw.peak_end, raw.peak_rate_multiplier)
        : null,
    models: list(raw.models).map(toModel).filter(notNull),
  };
}

/** 广场数据 → 分组列表（沿用后端顺序：倍率从低到高）；没有模型的分组不要；看不懂时返回 null */
export function toConsoleChannels(raw: unknown): ConsoleChannel[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.groups)) return null;
  return list(raw.groups)
    .map(toChannel)
    .filter(notNull)
    .filter((channel) => channel.models.length > 0);
}

/** 充值比例（付 1 元到账多少美元）：取支付配置里的 balance_recharge_multiplier，读不到按 1 */
export function rechargeMultiplierFrom(raw: unknown): number {
  const value = isRecord(raw) ? num(raw.balance_recharge_multiplier) : null;
  return value !== null && value > 0 ? value : 1;
}
