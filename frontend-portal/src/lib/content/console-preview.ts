import type { EditionId } from '@/lib/catalog';

/**
 * 首页控制台预览里的数字（占位）。区块只负责画，数字都从这里取。
 * 标签文字在 homeHero.preview 里，这里只放数值与模型名。
 */
export const PREVIEW_STATS = {
  monthSpendUsd: 1284.52,
  monthSpendDelta: 12.4,
  requests: 2_481_920,
  requestsDelta: 8.1,
  tokens: 1_920_000_000,
  tokensDelta: 15.7,
  availability: 99.96,
} as const;

/** 近 14 天每日请求数（千次），折线图从左到右 */
export const PREVIEW_DAILY_REQUESTS: readonly number[] = [
  132, 141, 128, 156, 171, 163, 149, 182, 196, 188, 205, 219, 211, 236,
];

/** 模型调用占比（%），柱状图从上到下，合计 100 */
export const PREVIEW_MODEL_SHARE: readonly { model: string; percent: number }[] = [
  { model: 'Claude Sonnet 5.5', percent: 41 },
  { model: 'GPT-6 Sol', percent: 27 },
  { model: 'Gemini 3.5 Flash', percent: 18 },
  { model: 'GPT Image 2', percent: 9 },
  { model: 'DeepSeek V4 Pro', percent: 5 },
];

/** 分组消费占比（%），环形图，合计 100；一个版本就是一个分组 */
export const PREVIEW_GROUP_SPEND: readonly { edition: EditionId; percent: number }[] = [
  { edition: 'pro', percent: 72 },
  { edition: 'personal', percent: 28 },
];

/** 最近请求，表格从上到下 */
export const PREVIEW_RECENT: readonly {
  time: string;
  model: string;
  tokens: number;
  costUsd: number;
  ok: boolean;
}[] = [
  { time: '14:32:08', model: 'claude-sonnet-5-5', tokens: 18_420, costUsd: 0.0412, ok: true },
  { time: '14:31:55', model: 'gpt-6-sol', tokens: 9_870, costUsd: 0.0062, ok: true },
  { time: '14:31:41', model: 'gpt-image-2', tokens: 0, costUsd: 0.067, ok: true },
  { time: '14:31:29', model: 'gemini-3.5-flash', tokens: 31_200, costUsd: 0.0298, ok: true },
  { time: '14:31:12', model: 'claude-sonnet-5-5', tokens: 4_310, costUsd: 0.0097, ok: false },
];
