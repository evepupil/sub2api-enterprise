import type { ColumnPrefsConfig } from '@/lib/console/live/column-prefs';

/** 日志表可选的列，按表格里的顺序；最右边的操作列总在，不在这里 */
export const LOG_COLUMNS = [
  'time',
  'key',
  'model',
  'reasoning',
  'tokens',
  'cost',
  'duration',
  'ip',
] as const;

export type LogColumn = (typeof LOG_COLUMNS)[number];

/** 默认显示原来那几列，推理强度和 IP 要在「列设置」里勾上（2026-10-04 用户要求） */
export const DEFAULT_LOG_COLUMNS: readonly LogColumn[] = [
  'time',
  'key',
  'model',
  'tokens',
  'cost',
  'duration',
];

export const LOG_COLUMN_PREFS: ColumnPrefsConfig<LogColumn> = {
  storageKey: 'console-log-columns',
  columns: LOG_COLUMNS,
  defaults: DEFAULT_LOG_COLUMNS,
  locked: ['time'],
};

/** 各列大致要的宽度（px） */
const COLUMN_WIDTH: Record<LogColumn, number> = {
  time: 110,
  key: 170,
  model: 190,
  reasoning: 90,
  tokens: 150,
  cost: 120,
  duration: 140,
  ip: 130,
};
const ACTIONS_WIDTH = 50;

/** 表格最窄的宽度 = 显示的列加起来 + 操作列：再窄就在外框里横向滚动，不让页面横向溢出 */
export function logsTableMinWidth(visible: readonly LogColumn[]): number {
  return visible.reduce((sum, column) => sum + COLUMN_WIDTH[column], ACTIONS_WIDTH);
}
