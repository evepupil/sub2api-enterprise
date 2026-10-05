'use client';

import { useTranslations } from 'next-intl';

import type { ModelHealth, ProbeStatus } from '@/lib/catalog/live';
import { cn } from '@/lib/utils';

/** 可用性数字的颜色：≥ 99.5 绿、≥ 98 琥珀、其余红，一律映射完整类名 */
const AVAILABILITY_TONE = {
  high: 'text-success',
  mid: 'text-warning',
  low: 'text-danger',
} as const;

function availabilityTone(percent: number): keyof typeof AVAILABILITY_TONE {
  if (percent >= 99.5) return 'high';
  if (percent >= 98) return 'mid';
  return 'low';
}

/** 每次探测一根细条：正常绿、变慢琥珀、不可用红、无数据灰（只做色块，用 *-graphic 令牌） */
const PROBE_TONE: Record<ProbeStatus, string> = {
  up: 'bg-success-graphic',
  slow: 'bg-warning-graphic',
  down: 'bg-danger-graphic',
  unknown: 'bg-muted',
};

function LatencyStat({ label, value, id }: { label: string; value: number | null; id: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2">
      <p className="truncate text-xs text-subtle-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        <span data-latency={id}>{value === null ? '—' : Math.round(value)}</span>
        {value === null ? null : (
          <span className="ml-0.5 text-xs font-normal text-subtle-foreground">ms</span>
        )}
      </p>
    </div>
  );
}

/**
 * 模型卡上的可用率一块（数据来自后台给这个模型建的渠道监测项，照 sub2api 的渠道状态页）：
 * 最近一次的对话延迟与端点 PING、近 7 天可用性、近 60 次探测结果（从早到晚）。
 */
export function ModelsHealth({ health }: { health: ModelHealth }) {
  const t = useTranslations('models');
  const count = health.probes.length;
  const passed = health.probes.filter((probe) => probe === 'up' || probe === 'slow').length;

  return (
    <div data-model-health className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <LatencyStat id="chat" label={t('card.latency')} value={health.latencyMs} />
        <LatencyStat id="ping" label={t('card.ping')} value={health.pingMs} />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-subtle-foreground">{t('card.availability')}</span>
        <span
          data-availability
          className={cn(
            'font-medium tabular-nums',
            AVAILABILITY_TONE[availabilityTone(health.availability)],
          )}
        >
          {health.availability.toFixed(2)}%
        </span>
      </div>
      {count > 0 ? (
        <div>
          <p className="text-xs text-subtle-foreground">{t('card.probes', { count })}</p>
          {/* 一排细条是有含义的图形，用 role="img" + 一句话说明 */}
          <div
            role="img"
            data-probes={count}
            aria-label={t('card.probesLabel', { count, up: passed })}
            className="mt-1.5 flex h-5 gap-px"
          >
            {health.probes.map((probe, index) => (
              <span key={index} className={cn('flex-1 rounded-[1px]', PROBE_TONE[probe])} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ModelsHealth;
