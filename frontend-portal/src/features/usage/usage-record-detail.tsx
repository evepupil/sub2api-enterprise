'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { formatUsd } from '../../lib/money';
import type { UsageRecord } from './types';

/** 数字：千分位，无小数。 */
export function formatUsageNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}

/** 耗时：毫秒转秒，保留 2 位；无值显示占位而不是 0。 */
export function formatUsageDuration(value: number | null): string {
  if (value === null) return '—';
  return `${new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 1000)} 秒`;
}

/** 时间：按范围时区展示到秒；无法解析时原样显示，不伪造当前时间。 */
export function formatUsageDateTime(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  try {
    return new Intl.DateTimeFormat(
      'zh-CN',
      timeZone === undefined ? options : { ...options, timeZone },
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
  }
}

export interface UsageRecordDetailProps {
  /** 选中的明细记录；null 表示关闭。 */
  record: UsageRecord | null;
  /** 当前范围的统一时区，用于时间展示。 */
  timeZone: string;
  /** 打开/关闭状态变化（Radix 关闭动画期间 record 可能已为 null）。 */
  onOpenChange: (open: boolean) => void;
}

interface DetailRow {
  label: string;
  value: string;
}

/** 调用明细弹窗：完整模型名、时间、4 类 Token、标准价与实际消费、流式标记。 */
export function UsageRecordDetail({ record, timeZone, onOpenChange }: UsageRecordDetailProps) {
  const rows: DetailRow[] =
    record === null
      ? []
      : [
          { label: '完整模型名', value: record.model },
          { label: '时间', value: formatUsageDateTime(record.createdAt, timeZone) },
          { label: '密钥名称', value: record.keyName === '' ? '—' : record.keyName },
          { label: '密钥 ID', value: String(record.keyId) },
          { label: '输入 Token', value: formatUsageNumber(record.tokens.input) },
          { label: '缓存写入 Token', value: formatUsageNumber(record.tokens.cacheWrite) },
          { label: '缓存读取 Token', value: formatUsageNumber(record.tokens.cacheRead) },
          { label: '输出 Token', value: formatUsageNumber(record.tokens.output) },
          { label: 'Token 合计', value: formatUsageNumber(record.tokens.total) },
          { label: '标准价', value: formatUsd(record.standardCost) },
          { label: '实际消费', value: formatUsd(record.actualCost) },
          { label: '耗时', value: formatUsageDuration(record.durationMs) },
          { label: '请求类型', value: record.stream ? '流式' : '非流式' },
        ];

  return (
    <Dialog open={record !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {record === null ? null : (
          <>
            <DialogHeader>
              <DialogTitle>调用明细</DialogTitle>
              <DialogDescription>记录 #{record.id}</DialogDescription>
            </DialogHeader>
            <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="break-words text-sm text-foreground tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
