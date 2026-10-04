import type { DateRange } from '@/lib/console';
import type { LogRow, LogStream, LogType } from '@/lib/console/live/logs-types';

/**
 * 打开某条调用的详情抽屉。
 * opener 是打开抽屉的那个按钮：抽屉关闭后要把键盘焦点还给它（见 logs-page 里的说明）。
 */
export type OpenLogDetail = (log: LogRow, opener: HTMLElement | null) => void;

/** 页面上的筛选选择；range 为 null 表示还没选过（用默认的最近 30 天） */
export interface LogSelection {
  range: DateRange | null;
  keyId: number | null;
  model: string | null;
  type: LogType;
  stream: LogStream;
}

export const DEFAULT_SELECTION: LogSelection = {
  range: null,
  keyId: null,
  model: null,
  type: 'all',
  stream: 'all',
};

/** 筛选是否偏离默认（决定要不要显示「清除筛选」）：时间回到最近 30 天、其余都不限才算默认 */
export function isDefaultSelection(selection: LogSelection): boolean {
  return (
    (selection.range === null || selection.range.preset === 'last30d') &&
    selection.keyId === null &&
    selection.model === null &&
    selection.type === 'all' &&
    selection.stream === 'all'
  );
}
