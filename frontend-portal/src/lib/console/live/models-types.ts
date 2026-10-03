/**
 * 控制台模型页的真实数据：官网服务器把后端「模型广场」（/api/v1/model-plaza，带登录状态）整理成这个形状。
 * 单价一律是美元 / 每 Token（按次、按张的是美元 / 次），都还没乘通道倍率；乘倍率、换币种在页面上算。
 */

/** 一档 Token 单价；null 表示后端没给这一项 */
export interface TokenRates {
  input: number | null;
  output: number | null;
}

/** 长上下文分档：输入 Token 数落在 [minTokens, maxTokens) 时的单价（已解析成绝对价） */
export interface PriceTier extends TokenRates {
  minTokens: number;
  /** 最后一档没有上限 */
  maxTokens: number | null;
}

/** 某个时段的价格倍率（HH:MM，按后端配置的时区） */
export interface TimeWindow {
  start: string;
  end: string;
  multiplier: number;
}

/** 计费方式：按 Token、按次、按张（生图）、按条（视频） */
export type BillingMode = 'token' | 'per_request' | 'image' | 'video';

export interface ChannelModel {
  /** 调用时填的模型名 */
  id: string;
  /** 后端平台：openai / anthropic / gemini / antigravity 等 */
  platform: string;
  billing: BillingMode;
  /** 按 Token 计费的基础单价 */
  base: TokenRates;
  /** 长上下文分档，首档从 0 开始；没有分档时为空 */
  tiers: PriceTier[];
  /** 按次 / 按张的单价；有分档（如分辨率）时是最低一档 */
  perRequest: number | null;
  /** 按次计费是否有多档（显示「起」） */
  perRequestTiered: boolean;
  /** 官方参考价（不乘倍率）；后端查不到时为 null */
  official: TokenRates | null;
  /** 分时段倍率（只给倍率不是 1 的时段） */
  timePricing: { weekdaysOnly: boolean; windows: TimeWindow[] } | null;
}

export interface ConsoleChannel {
  /** 后端分组 ID */
  id: string;
  name: string;
  /** 生效倍率：账号有专属倍率时用专属倍率 */
  rate: number;
  /** 分组默认倍率（和生效倍率不同时，说明账号有专属倍率） */
  defaultRate: number;
  /** 开了「生图独立倍率」时，生图模型用这个倍率；没开为 null */
  imageRate: number | null;
  /** 分组是否按长上下文分档计费；没开时只按首档计价 */
  longContext: boolean;
  /** 高峰时段：落在时段内的请求价格再乘倍率 */
  peak: TimeWindow | null;
  models: ChannelModel[];
}

export interface ConsoleModelsData {
  channels: ConsoleChannel[];
  /** 充值比例：付 1 元到账多少美元。人民币价格 = 美元价 ÷ 它 */
  rechargeMultiplier: number;
}
