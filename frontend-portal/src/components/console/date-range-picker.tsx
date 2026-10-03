'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import type { AppLocale } from '@/i18n/routing';
import {
  customRange,
  formatDayLabel,
  formatMonthTitle,
  monthMatrix,
  presetRange,
  RANGE_PRESETS,
  TODAY,
  type DateRange,
  type RangePreset,
} from '@/lib/console/time';
import { cn } from '@/lib/utils';

import { CONTROL_BUTTON } from './control-button';

type Translator = ReturnType<typeof useTranslations<'console'>>;

/** 范围按钮上的文字：预设显示名称，自定义显示起止日期 */
export function rangeLabel(range: DateRange, t: Translator, locale: AppLocale): string {
  if (range.preset) return t(`range.${range.preset}`);
  if (range.from === range.to) return formatDayLabel(range.from, locale);
  return `${formatDayLabel(range.from, locale)} – ${formatDayLabel(range.to, locale)}`;
}

const WEEKDAY_KEYS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'] as const;

interface Draft {
  from: string | null;
  to: string | null;
}

const TODAY_YEAR = Number(TODAY.slice(0, 4));
const TODAY_MONTH = Number(TODAY.slice(5, 7));

/**
 * 时间范围选择：左侧常用范围（点了立即生效），右侧月历自选起止日（点「应用」生效）。
 * 今天之后的日期不能选。交互检查：触发按钮 data-range-trigger，预设 data-range-preset，
 * 日期 data-day，应用 data-range-apply。
 */
export function DateRangePicker({
  value,
  onChange,
  align = 'end',
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  align?: 'start' | 'end';
  className?: string;
}) {
  const t = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ from: null, to: null });
  const [view, setView] = useState({ year: TODAY_YEAR, month: TODAY_MONTH });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft({ from: value.from, to: value.to });
      setView({ year: Number(value.to.slice(0, 4)), month: Number(value.to.slice(5, 7)) });
    }
    setOpen(next);
  };

  const choosePreset = (preset: RangePreset) => {
    onChange(presetRange(preset));
    setOpen(false);
  };

  const clickDay = (day: string) => {
    if (day > TODAY) return;
    // 已经选好一段时，再点就重新开始；否则这一下是结束日
    setDraft((current) =>
      current.from === null || current.to !== null
        ? { from: day, to: null }
        : { from: current.from, to: day },
    );
  };

  const apply = () => {
    if (draft.from === null) return;
    onChange(customRange(draft.from, draft.to ?? draft.from));
    setOpen(false);
  };

  const shiftMonth = (step: 1 | -1) =>
    setView(({ year, month }) => {
      const index = year * 12 + (month - 1) + step;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  const atLatestMonth = view.year === TODAY_YEAR && view.month === TODAY_MONTH;

  const [low, high] =
    draft.from !== null && draft.to !== null
      ? draft.from <= draft.to
        ? [draft.from, draft.to]
        : [draft.to, draft.from]
      : [draft.from, draft.from];

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-range-trigger
          aria-label={t('range.label')}
          className={buttonClass({
            variant: 'secondary',
            className: cn(CONTROL_BUTTON, 'justify-between gap-2 px-3', className),
          })}
        >
          <CalendarDays aria-hidden />
          <span className="truncate">{rangeLabel(value, t, locale)}</span>
          <ChevronDown aria-hidden className="size-3.5! text-subtle-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          data-range-panel
          className="z-50 flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-card sm:flex-row"
        >
          <div className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-36 sm:flex-col sm:border-b-0 sm:border-r">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                data-range-preset={preset}
                aria-pressed={value.preset === preset}
                onClick={() => choosePreset(preset)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  value.preset === preset ? 'bg-muted font-medium' : 'text-muted-foreground',
                )}
              >
                {t(`range.${preset}`)}
              </button>
            ))}
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                data-range-prev
                aria-label={t('range.prevMonth')}
                onClick={() => shiftMonth(-1)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <span className="text-sm font-medium">
                {formatMonthTitle(view.year, view.month, locale)}
              </span>
              <button
                type="button"
                data-range-next
                aria-label={t('range.nextMonth')}
                disabled={atLatestMonth}
                onClick={() => shiftMonth(1)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-xs text-subtle-foreground">
              {WEEKDAY_KEYS.map((key) => (
                <span key={key} className="py-1">
                  {t(`range.${key}`)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {monthMatrix(view.year, view.month)
                .flat()
                .map((cell) => {
                  const disabled = cell.day > TODAY;
                  const isEdge = cell.day === low || cell.day === high;
                  const inside = low !== null && high !== null && cell.day > low && cell.day < high;
                  return (
                    <button
                      key={cell.day}
                      type="button"
                      data-day={cell.day}
                      disabled={disabled}
                      aria-pressed={isEdge || inside}
                      onClick={() => clickDay(cell.day)}
                      className={cn(
                        'size-9 rounded-md text-sm tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-30',
                        isEdge
                          ? 'bg-primary font-medium text-primary-foreground'
                          : inside
                            ? 'rounded-none bg-muted text-foreground'
                            : cell.inMonth
                              ? 'text-foreground hover:bg-muted'
                              : 'text-subtle-foreground/60 hover:bg-muted',
                        cell.day === TODAY &&
                          !isEdge &&
                          'font-semibold underline underline-offset-4',
                      )}
                    >
                      {Number(cell.day.slice(8, 10))}
                    </button>
                  );
                })}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button size="sm" data-range-apply disabled={draft.from === null} onClick={apply}>
                {t('range.apply')}
              </Button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
