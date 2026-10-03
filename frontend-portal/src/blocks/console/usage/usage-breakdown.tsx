'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Panel } from '@/components/console/panel';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { AppLocale } from '@/i18n/routing';
import { getEdition, getModel, isEditionId } from '@/lib/catalog';
import {
  getKey,
  USAGE_METRICS,
  type DateRange,
  type UsageMetric,
  type UsageRecord,
} from '@/lib/console';

import { UsageBreakdownChart } from './usage-breakdown-chart';

/**
 * 用量明细：一个指标开关（Token / 请求数 / 费用）控制下面三张图，
 * 分别按模型、按 API 密钥、按通道看同一段时间的用量构成。
 */
export function UsageBreakdown({
  records,
  range,
  metric,
  onMetricChange,
}: {
  records: readonly UsageRecord[];
  range: DateRange;
  metric: UsageMetric;
  onMetricChange: (metric: UsageMetric) => void;
}) {
  const t = useTranslations('consoleUsage');
  const locale = useLocale() as AppLocale;

  const metricOptions = USAGE_METRICS.map((value) => ({ value, label: t(`detail.${value}`) }));

  // 图例里的名字：模型和密钥只有一种写法，通道名跟随当前语言
  const modelName = (id: string) => getModel(id).name;
  const keyName = (id: string) => getKey(id).name;
  const groupName = (id: string) => (isEditionId(id) ? getEdition(id).name[locale] : id);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{t('detail.title')}</h2>
        <SegmentedControl
          name="usage-metric"
          size="sm"
          value={metric}
          onChange={onMetricChange}
          ariaLabel={t('detail.metric')}
          options={metricOptions}
        />
      </div>
      <div className="space-y-6">
        <Panel id="by-model" title={t('detail.byModel')}>
          <UsageBreakdownChart
            id="by-model"
            records={records}
            range={range}
            dimension="model"
            metric={metric}
            seriesName={modelName}
            ariaLabel={t('detail.ariaModel')}
            height={260}
          />
        </Panel>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel id="by-key" title={t('detail.byKey')}>
            <UsageBreakdownChart
              id="by-key"
              records={records}
              range={range}
              dimension="key"
              metric={metric}
              seriesName={keyName}
              ariaLabel={t('detail.ariaKey')}
              height={220}
            />
          </Panel>
          <Panel id="by-group" title={t('detail.byGroup')}>
            <UsageBreakdownChart
              id="by-group"
              records={records}
              range={range}
              dimension="group"
              metric={metric}
              seriesName={groupName}
              ariaLabel={t('detail.ariaGroup')}
              height={220}
            />
          </Panel>
        </div>
      </div>
    </section>
  );
}
