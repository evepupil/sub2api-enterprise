import type { AppLocale } from '@/i18n/routing';

/** 中英两份的文案字段，用 localize() 取当前语言 */
export type Localized = Record<AppLocale, string>;

export type ProviderId =
  'openai' | 'anthropic' | 'google' | 'deepseek' | 'moonshot' | 'zhipu' | 'minimax' | 'qwen';

export interface Provider {
  id: ProviderId;
  name: string;
  /** public/ 下的标志路径 */
  logo: string;
  /** 单色标志：暗色主题下要反色（dark:invert） */
  mono: boolean;
}

export type ModelType = 'text' | 'image';

export type Protocol =
  'openai-chat' | 'openai-responses' | 'anthropic-messages' | 'gemini' | 'openai-images';

export type EditionId = 'personal' | 'pro' | 'enterprise';

/** 官方价，美元 / 百万 Token */
export interface TokenPrice {
  input: number;
  output: number;
  cacheRead: number;
}

/** 超长上下文档：输入超过 threshold 个 Token 后的官方价 */
export interface LongContextTier {
  threshold: number;
  input: number;
  output: number;
}

/** 生图官方价：按张（分辨率档）或按百万输出 Token，二选一 */
export type ImagePrice =
  | { kind: 'per-image'; resolutions: readonly { label: string; price: number }[] }
  | { kind: 'per-token'; perMTokens: number };

export interface Model {
  /** 调用时填的模型名 */
  id: string;
  name: string;
  provider: ProviderId;
  type: ModelType;
  protocols: readonly Protocol[];
  /** 上下文长度（Token），生图模型没有 */
  contextTokens: number | null;
  /** 上线日期 YYYY-MM-DD，用于「最新」排序和「新」标记 */
  released: string;
  description: Localized;
  /** 文本模型官方价 */
  official: TokenPrice | null;
  longContext: LongContextTier | null;
  /** 生图模型官方价 */
  image: ImagePrice | null;
}
