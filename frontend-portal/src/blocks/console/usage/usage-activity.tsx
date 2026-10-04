'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ActivityHeatmap } from '@/components/console/charts/activity-heatmap';
import { Panel } from '@/components/console/panel';
import { Skeleton } from '@/components/console/skeleton';
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
 * 热力图的格子随宽度伸缩、铺满所在一栏；超宽屏（2xl）和右边 360px 宽的小格子左右并排、上下居中，
 * 其余宽度上下排（小格子一排四个）。heat、stats 为 null 时还在加载，对应位置显示占位块。
 */
export function UsageActivity({
  heat,
  stats,
}: {
  heat: Heatmap | null;
  stats: ActivityStats | null;
}) {
  const t = useTranslations('consoleUsage');
  const locale = useLocale() as AppLocale;

  return (
    <Panel id="activity" title={t('activity.title')}>
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-center">
        <div className="min-w-0">
          {heat ? (
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
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-2">
          {stats ? <ActivityStatCards stats={stats} locale={locale} /> : <ActivityStatSkeletons />}
        </div>
      </div>
    </Panel>
  );
}

/** 所选范围内的四个小格子：活跃天数、最长连续、范围消费、最活跃的一天 */
function ActivityStatCards({ stats, locale }: { stats: ActivityStats; locale: AppLocale }) {
  const t = useTranslations('consoleUsage');
  const top = stats.mostActive;
  const topSub = top
    ? t('activity.topDaySub', { tokens: formatCompact(top.tokens), cost: formatUsd(top.costUsd) })
    : null;
  return (
    <>
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
        // 和热力图并排（2xl）时说明固定一行（放不下时省略，悬停看全文），不把这一排撑得比旁边高；
        // 其余宽度照常最多折两行，手机上金额不被截掉
        sub={
          topSub ? (
            <span className="block 2xl:truncate" title={topSub}>
              {topSub}
            </span>
          ) : undefined
        }
      />
    </>
  );
}

/** 小格子加载中：标签照常显示，数字处是占位块 */
function ActivityStatSkeletons() {
  const t = useTranslations('consoleUsage');
  const value = <Skeleton className="mt-1 h-5 w-16" />;
  return (
    <>
      <StatCard size="sm" id="active-days" label={t('activity.activeDays')} value={value} />
      <StatCard size="sm" id="streak" label={t('activity.streak')} value={value} />
      <StatCard size="sm" id="range-cost" label={t('activity.rangeCost')} value={value} />
      <StatCard size="sm" id="top-day" label={t('activity.topDay')} value={value} />
    </>
  );
}
