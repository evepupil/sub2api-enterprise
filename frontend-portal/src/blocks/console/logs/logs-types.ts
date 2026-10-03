import type { RequestLog } from '@/lib/console';

/**
 * 打开某条请求的详情抽屉。
 * opener 是打开抽屉的那个按钮：抽屉关闭后要把键盘焦点还给它（见 logs-page 里的说明）。
 */
export type OpenLogDetail = (log: RequestLog, opener: HTMLElement | null) => void;
