'use client';

/**
 * 模型卡：价格、折扣标、可用率都随当前版本（?edition=）变化。
 * 复制调用名成功后短暂换成对勾，1.5 秒恢复；剪贴板不可用或失败时静默。
 */

import { useEffect, useRef, useState } from 'react';

import { ArrowRight, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import {
  PROTOCOL_LABELS,
  effectiveDiscount,
  formatContext,
  formatMoney,
  getProvider,
  imagePrice,
  isNewModel,
  localize,
  textPrice,
  uptimeFor,
  type EditionId,
  type Model,
  type SlotStatus,
} from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** 可用率文字颜色：≥ 99.5 绿、≥ 98 琥珀、其余红，一律映射完整类名 */
const UPTIME_TONE = {
  high: 'text-success font-medium',
  mid: 'text-warning font-medium',
  low: 'text-danger font-medium',
} as const;

type UptimeTone = keyof typeof UPTIME_TONE;

function uptimeTone(percent: number): UptimeTone {
  if (percent >= 99.5) return 'high';
  if (percent >= 98) return 'mid';
  return 'low';
}

/** 状态格颜色：正常绿、降级琥珀、中断红（只做色块，用 *-graphic 令牌） */
const SLOT_TONE: Record<SlotStatus, string> = {
  up: 'bg-success-graphic',
  degraded: 'bg-warning-graphic',
  down: 'bg-danger-graphic',
};

export function ModelsExplorerCard({
  model,
  edition,
  locale,
}: {
  model: Model;
  edition: EditionId;
  locale: AppLocale;
}) {
  const t = useTranslations('models');
  const tc = useTranslations('common');
  const provider = getProvider(model.provider);
  const uptime = uptimeFor(model.id, edition);

  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // 卸载时清掉恢复图标的定时器，避免对已卸载的组件 setState
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const copyId = () => {
    // 可选链：clipboard 不存在（非安全上下文）时整条链路静默跳过；写入失败也不提示
    navigator.clipboard
      ?.writeText(model.id)
      .then(() => {
        setCopied(true);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  const price = textPrice(model, edition);
  const image = imagePrice(model, edition);

  return (
    <article
      data-model-card={model.id}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2">
        <ProviderLogo provider={model.provider} size={18} />
        <span className="min-w-0 truncate text-sm text-muted-foreground">{provider.name}</span>
        {isNewModel(model) ? <Badge tone="info">{t('card.new')}</Badge> : null}
        <span className="flex-1" />
        {model.type === 'image' ? <Badge tone="outline">{t('card.image')}</Badge> : null}
      </div>

      <h3 className="mt-3 truncate text-base font-semibold text-foreground">{model.name}</h3>

      <div className="mt-1 flex items-center gap-1.5">
        <code className="min-w-0 truncate font-mono text-xs text-subtle-foreground">
          {model.id}
        </code>
        <button
          type="button"
          data-copy-id={model.id}
          aria-label={t('card.copy')}
          onClick={copyId}
          className="shrink-0 rounded p-1 text-subtle-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check aria-hidden className="size-3.5 text-success" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
        </button>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {localize(model.description, locale)}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {model.protocols.map((protocol) => (
          <Badge key={protocol} tone="outline">
            {PROTOCOL_LABELS[protocol]}
          </Badge>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          {price ? (
            <>
              <p className="text-xs text-subtle-foreground">{t('card.inputOutput')}</p>
              <p
                data-card-price
                className="mt-0.5 text-sm font-medium tabular-nums text-foreground"
              >
                {formatMoney(price.input, 'usd')} / {formatMoney(price.output, 'usd')}
                <span className="text-xs font-normal text-subtle-foreground">
                  {' '}
                  {tc('units.perMTokens')}
                </span>
              </p>
            </>
          ) : image?.kind === 'per-image' ? (
            <>
              <p className="text-xs text-subtle-foreground">{t('card.perImage')}</p>
              <p
                data-card-price
                className="mt-0.5 text-sm font-medium tabular-nums text-foreground"
              >
                {formatMoney(image.from, 'usd')} {tc('units.from')}
              </p>
            </>
          ) : image ? (
            <>
              <p className="text-xs text-subtle-foreground">{t('card.estimate')}</p>
              <p
                data-card-price
                className="mt-0.5 text-sm font-medium tabular-nums text-foreground"
              >
                {tc('units.approx')} {formatMoney(image.estimatedPerImage, 'usd')}
              </p>
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <DiscountBadge discount={effectiveDiscount(model, edition)} locale={locale} />
          {model.contextTokens !== null ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatContext(model.contextTokens)} {t('card.context')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-subtle-foreground">{t('card.uptime')}</span>
          <span data-uptime className={UPTIME_TONE[uptimeTone(uptime.percent)]}>
            {uptime.percent.toFixed(2)}%
          </span>
        </div>
        {/* 24 个小时格是有含义的图形，用 role="img" + 一句话说明 */}
        <div
          role="img"
          aria-label={t('card.uptimeLabel', { percent: uptime.percent })}
          className="mt-2 flex gap-0.5"
        >
          {uptime.slots.map((slot, index) => (
            <span key={index} className={cn('h-5 flex-1 rounded-[2px]', SLOT_TONE[slot])} />
          ))}
        </div>
      </div>

      <Link
        href={{
          pathname: '/pricing',
          query: edition === 'personal' ? {} : { edition },
          hash: `model-${model.id}`,
        }}
        data-card-pricing
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
      >
        {t('card.pricing')}
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </article>
  );
}

export default ModelsExplorerCard;
