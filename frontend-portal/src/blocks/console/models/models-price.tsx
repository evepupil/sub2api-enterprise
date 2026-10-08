'use client';

import { useTranslations } from 'next-intl';

import { formatContext } from '@/lib/catalog';
import {
  formatLiveMoney,
  type ModelRowView,
  type PriceWindow,
} from '@/lib/console/live/models-view';
import { cn } from '@/lib/utils';

/** 金额格式化：没有这一项时写「—」 */
const money = (usd: number | null): string => (usd === null ? '—' : formatLiveMoney(usd));

/** 时段说明：「高峰 20:00–23:00 ×1.5」「工作日 00:30–08:30 ×0.5」 */
function WindowLine({ window }: { window: PriceWindow }) {
  const t = useTranslations('consoleModels');
  const values = { window: `${window.start}–${window.end}`, multiplier: window.multiplier };
  const text =
    window.kind === 'peak'
      ? t('table.peak', values)
      : window.weekdaysOnly
        ? t('table.timeWindowWeekdays', values)
        : t('table.timeWindow', values);
  return <p className="text-xs text-subtle-foreground">{text}</p>;
}

/**
 * 价格列：当前分组的实付价（后端单价 × 分组倍率）。按 Token 计费的是「输入 / 输出」每百万 Token，
 * 有长上下文分档时多一行加价档；按张、按次计费的是单价；下面再列高峰、分时段的加价。
 * 交互检查用 data-model-price 取这一格。
 */
export function ModelPrice({ row }: { row: ModelRowView }) {
  const t = useTranslations('consoleModels');
  const { price } = row;

  return (
    <div data-model-price={row.id} className="tabular-nums">
      {price.kind === 'token' ? (
        <>
          <p className="font-medium text-foreground">{`${money(price.input)} / ${money(price.output)}`}</p>
          <p className="text-xs text-subtle-foreground">{t('table.perMTokens')}</p>
          {price.longContext ? (
            <p className="text-xs text-subtle-foreground">
              {t('table.longContext', {
                threshold: formatContext(price.longContext.threshold),
                input: money(price.longContext.input),
                output: money(price.longContext.output),
              })}
            </p>
          ) : null}
        </>
      ) : price.kind === 'request' ? (
        <p className="font-medium text-foreground">
          {t(
            price.unit === 'image'
              ? price.from
                ? 'table.perImageFrom'
                : 'table.perImage'
              : price.from
                ? 'table.perRequestFrom'
                : 'table.perRequest',
            { price: money(price.price) },
          )}
        </p>
      ) : (
        <p className="text-subtle-foreground">—</p>
      )}
      {row.windows.map((window) => (
        <WindowLine key={`${window.kind}-${window.start}-${window.end}`} window={window} />
      ))}
    </div>
  );
}

/**
 * 官方价列：输入 / 输出的官方价（分组倍率已写在分组列，这里不再写「几折」）。
 * 比官方价便宜时把官方价划掉，让人一眼看出省了多少；按张、按次计费的模型和官方价单位不同，不显示。
 */
export function ModelOfficialPrice({ row }: { row: ModelRowView }) {
  if (!row.official) return <span className="text-subtle-foreground">—</span>;

  return (
    <p
      data-model-official={row.id}
      className={cn(
        'text-xs tabular-nums text-subtle-foreground',
        row.discount !== null && 'line-through',
      )}
    >
      {`${money(row.official.input)} / ${money(row.official.output)}`}
    </p>
  );
}
