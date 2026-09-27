'use client';

import { CalendarDays } from 'lucide-react';
import * as React from 'react';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';

import type { DatePreset, DateRange } from '../../features/usage/types';
import {
  DATE_PRESETS,
  formatDateRange,
  fromCalendarDate,
  getPresetRange,
  isValidDateString,
  toCalendarDate,
} from '../../lib/time/date-range';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/** 八种预选的中文文案，顺序与 DATE_PRESETS 一致。 */
const PRESET_LABELS: Record<DatePreset, string> = {
  today: '今天',
  yesterday: '昨天',
  last7: '近 7 天',
  last14: '近 14 天',
  last30: '近 30 天',
  thisWeek: '本周',
  thisMonth: '本月',
  lastMonth: '上月',
};

/** 桌面（md 及以上）同时显示两个月，手机只显示一个月。 */
function subscribeTwoMonth(onChange: () => void): () => void {
  const query = window.matchMedia('(min-width: 768px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getTwoMonthSnapshot(): boolean {
  return window.matchMedia('(min-width: 768px)').matches;
}

function getTwoMonthServerSnapshot(): boolean {
  return false;
}

export interface DateRangeControlProps {
  /** 当前生效的日期范围（含统一时区），由父组件持有。 */
  value: DateRange;
  /** 预选点击立即调用；自定义范围只有点「应用」后才调用。 */
  onChange: (range: DateRange) => void;
  /** 触发器附加类名。 */
  className?: string;
}

interface Draft {
  start: string;
  end: string;
}

/**
 * 日期范围控件：按钮显示当前预选名与起止日期，展开后左侧 8 项预选、
 * 右侧起止日期输入与 Calendar range。
 *
 * - 只有「日」粒度：不出现时分、没有近 24 小时；统一时区取自 value.timeZone。
 * - 预选点击立即 onChange；自定义改动只更新本地草稿，点「应用」才 onChange。
 * - 草稿非法（非法日历日或 start > end）时禁用「应用」并给出明确原因。
 * - 起止日期与 Calendar 的本地 Date 转换只用 lib/time/date-range 的纯函数。
 */
export function DateRangeControl({ value, onChange, className }: DateRangeControlProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>({ start: value.start, end: value.end });
  const twoMonths = React.useSyncExternalStore(
    subscribeTwoMonth,
    getTwoMonthSnapshot,
    getTwoMonthServerSnapshot,
  );

  const startId = React.useId();
  const endId = React.useId();

  /** 当前范围命中的预选名；都不是则为自定义。 */
  const presetLabel = React.useMemo(() => {
    for (const preset of DATE_PRESETS) {
      try {
        const presetRange = getPresetRange(preset, new Date(), value.timeZone);
        if (presetRange.start === value.start && presetRange.end === value.end) {
          return PRESET_LABELS[preset];
        }
      } catch {
        return null;
      }
    }
    return null;
  }, [value.start, value.end, value.timeZone]);

  const draftStartValid = isValidDateString(draft.start);
  const draftEndValid = isValidDateString(draft.end);
  const draftOrdered = draftStartValid && draftEndValid && draft.start <= draft.end;
  const draftValid = draftOrdered;

  const selectedRange: DayPickerDateRange = {
    from: draftStartValid ? toCalendarDate(draft.start) : undefined,
    to: draftEndValid ? toCalendarDate(draft.end) : undefined,
  };

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      // 每次展开都以当前生效范围重置草稿，未应用的编辑不残留。
      setDraft({ start: value.start, end: value.end });
    }
    setOpen(next);
  };

  const applyPreset = (preset: DatePreset): void => {
    const range = getPresetRange(preset, new Date(), value.timeZone);
    setDraft({ start: range.start, end: range.end });
    setOpen(false);
    onChange(range);
  };

  const handleSelect = (next: DayPickerDateRange | undefined): void => {
    if (next?.from === undefined) return;
    const start = fromCalendarDate(next.from);
    const end = next.to === undefined ? start : fromCalendarDate(next.to);
    setDraft({ start, end });
  };

  const applyDraft = (): void => {
    if (!draftValid) return;
    setOpen(false);
    onChange({ start: draft.start, end: draft.end, timeZone: value.timeZone });
  };

  const draftError = !draftStartValid
    ? '开始日期不是有效的日历日期'
    : !draftEndValid
      ? '结束日期不是有效的日历日期'
      : !draftOrdered
        ? '开始日期不能晚于结束日期'
        : null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn('justify-start gap-2', className)}
        >
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">
            {presetLabel ?? '自定义'} · {formatDateRange(value)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex min-w-0 flex-col gap-2 md:w-40">
            <p className="text-xs font-medium text-muted-foreground">预选范围</p>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => applyPreset(preset)}
                >
                  {PRESET_LABELS[preset]}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={startId} className="text-xs text-muted-foreground">
                开始日期
              </Label>
              <Input
                id={startId}
                type="date"
                value={draft.start}
                aria-invalid={!draftStartValid || undefined}
                onChange={(event) => setDraft((prev) => ({ ...prev, start: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={endId} className="text-xs text-muted-foreground">
                结束日期
              </Label>
              <Input
                id={endId}
                type="date"
                value={draft.end}
                aria-invalid={!draftEndValid || undefined}
                onChange={(event) => setDraft((prev) => ({ ...prev, end: event.target.value }))}
              />
            </div>
            <Calendar
              mode="range"
              numberOfMonths={twoMonths ? 2 : 1}
              defaultMonth={draftStartValid ? toCalendarDate(draft.start) : undefined}
              selected={selectedRange}
              onSelect={handleSelect}
            />
            {draftError !== null ? (
              <p role="alert" className="text-xs text-destructive">
                {draftError}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">统一时区：{value.timeZone}</p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button size="sm" disabled={!draftValid} onClick={applyDraft}>
                应用
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
