import { useLocale, useTranslations } from 'next-intl';

import { localize } from '@/lib/catalog';
import type { Localized } from '@/lib/catalog/types';
import type { AppLocale } from '@/i18n/routing';

/** 环形图每段的颜色，依次对应 PREVIEW_GROUP_SPEND 的各行（最多三段） */
const SEGMENT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

/**
 * 分组消费占比环形图：半径 46、线宽 14 的多段弧，
 * 每段长度按 percent 占周长的比例用 strokeDasharray 画出，整体旋转 -90° 从顶部起笔。
 */
export function ConsolePreviewGroupsChart({
  groups,
}: {
  groups: readonly {
    id: string;
    percent: number;
    name: Localized;
  }[];
}) {
  const t = useTranslations('homeHero.preview.charts.groups');
  const locale = useLocale() as AppLocale;

  const RADIUS = 46;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  // 每段弧的起点 = 前面各段长度之和；用 reduce 预先算好，避免渲染中累加可变变量
  const segments = groups.map((segment, i) => {
    const preceding = groups
      .slice(0, i)
      .reduce((sum, prev) => sum + (prev.percent / 100) * CIRCUMFERENCE, 0);
    return { ...segment, dash: (segment.percent / 100) * CIRCUMFERENCE, offset: -preceding };
  });

  return (
    <div className="mt-4 flex items-center gap-4">
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={t('title')}
        className="size-[120px] shrink-0"
      >
        {/* 弧的底色轨道，让不满 100% 时也看得出环形 */}
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth="14" />
        {segments.map((segment, i) => {
          const color = SEGMENT_COLORS[i];
          if (!color) return null;
          return (
            <circle
              key={segment.id}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
              strokeDashoffset={segment.offset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
        <text
          x="60"
          y="58"
          textAnchor="middle"
          fontSize="26"
          fontWeight="600"
          fill="var(--foreground)"
          className="tabular-nums"
        >
          {groups.length}
        </text>
        <text x="60" y="76" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
          {t('center')}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {groups.map((segment, i) => {
          const color = SEGMENT_COLORS[i];
          if (!color) return null;
          return (
            <li key={segment.id} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {localize(segment.name, locale)}
              </span>
              <span className="tabular-nums text-muted-foreground">{segment.percent}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
