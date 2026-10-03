'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ActivityHeatmap } from '@/components/console/charts/activity-heatmap';
import { Panel } from '@/components/console/panel';
import { StatCard } from '@/components/console/stat-card';
import type { AppLocale } from '@/i18n/routing';
import {
  formatCompact,
  formatDayLabel,
  formatInteger,
  formatMonthLabel,
  formatUsd,
  type ActivityStats,
  type Heatmap,
} from '@/lib/console';

/** 没有最活跃日时的占位 */
const NONE = '—';

/**
 * 活动面板：最近一年的每日用量热力图（固定看一年，不跟时间范围走）+ 四个小格子统计所选时间范围内的活跃情况。
 * 一年的热力图约 810px 宽，只有超宽屏（2xl）才和小格子左右并排，其余宽度上下排，热力图不被截断。
 */
export function UsageActivity({ heat, stats }: { heat: Heatmap; stats: ActivityStats }) {
  const t = useTranslations('consoleUsage');
  const locale = useLocale() as AppLocale;
  const top = stats.mostActive;

  return (
    <Panel id="activity" title={t('activity.title')}>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-start">
        <div className="min-w-0">
          <ActivityHeatmap
            data={heat}
            monthLabel={(month) => formatMonthLabel(month, locale)}
            cellTitle={(cell) =>
              cell.tokens > 0
                ? t('activity.cell', {
                    day: cell.day,
                    tokens: formatCompact(cell.tokens),
                    cost: formatUsd(cell.costUsd),
                  })
                : t('activity.idle', { day: cell.day })
            }
            ariaLabel={t('activity.aria')}
            lessLabel={t('activity.less')}
            moreLabel={t('activity.more')}
            weekdayLabels={[t('activity.mon'), t('activity.wed'), t('activity.fri')]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-2">
          <StatCard
            size="sm"
            id="active-days"
            label={t('activity.activeDays')}
            value={formatInteger(stats.activeDays)}
          />
          <StatCard
            size="sm"
            id="streak"
            label={t('activity.streak')}
            value={t('activity.streakValue', { count: stats.longestStreak })}
          />
          <StatCard
            size="sm"
            id="range-cost"
            label={t('activity.rangeCost')}
            value={formatUsd(stats.costUsd)}
          />
          <StatCard
            size="sm"
            id="top-day"
            label={t('activity.topDay')}
            value={top ? formatDayLabel(top.day, locale) : NONE}
            sub={
              top
                ? t('activity.topDaySub', {
                    tokens: formatCompact(top.tokens),
                    cost: formatUsd(top.costUsd),
                  })
                : undefined
            }
          />
        </div>
      </div>
    </Panel>
  );
}
