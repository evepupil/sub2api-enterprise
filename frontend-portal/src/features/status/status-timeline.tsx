'use client';

import { useState } from 'react';

import type { AvailabilityPoint, StatusLevel } from '../public/types';

const labels: Record<StatusLevel, string> = {
  operational: '正常',
  degraded: '性能下降',
  outage: '不可用',
  unknown: '暂无数据',
};
const colors: Record<StatusLevel, string> = {
  operational: 'bg-success',
  degraded: 'bg-warning',
  outage: 'bg-destructive',
  unknown: 'bg-muted',
};
const dateTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** 记录详情同时支持鼠标和键盘，避免只有原生 title 才能读到时间。 */
export function StatusTimeline({ points }: { points: readonly AvailabilityPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const selected = active === null ? undefined : points[active];
  const label = (point: AvailabilityPoint) =>
    `${dateTime.format(new Date(point.checkedAt))}（北京时间） · ${labels[point.level]}`;

  return (
    <div>
      <div className="max-w-full overflow-x-auto py-1">
        <ol className="flex min-w-full gap-1" aria-label="近期探测记录">
          {points.map((point, index) => (
            <li key={`${point.checkedAt}-${index}`} className="min-w-2 flex-1">
              <span
                role="img"
                tabIndex={0}
                title={label(point)}
                aria-label={label(point)}
                onFocus={() => setActive(index)}
                onMouseEnter={() => setActive(index)}
                className={`block h-7 w-full rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${colors[point.level]}`}
              />
            </li>
          ))}
        </ol>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs text-muted-foreground">
        {selected ? label(selected) : '正常 · 性能下降 · 不可用 · 暂无数据'}
      </p>
    </div>
  );
}
