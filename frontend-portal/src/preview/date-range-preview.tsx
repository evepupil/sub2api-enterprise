'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import type { DateRange } from 'react-day-picker';

const mobileQuery = '(max-width: 767px)';

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function isMobileViewport() {
  return window.matchMedia(mobileQuery).matches;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);
  const label = value?.from
    ? `${formatDate(value.from)}${value.to ? ` 至 ${formatDate(value.to)}` : ''}`
    : '选择日期';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          data-testid="date-range-trigger"
          variant="outline"
          aria-label={`选择日期，当前范围：${label}`}
          className="max-w-full justify-start"
        >
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={isMobile ? 1 : 2}
          defaultMonth={new Date(2026, 8, 1)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function DateRangePreview({
  value,
  onChange,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>日历</CardTitle>
      </CardHeader>
      <CardContent>
        <DateRangeControl value={value} onChange={onChange} />
      </CardContent>
    </Card>
  );
}
