import { useLocale, useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProviderLogo } from '@/components/catalog/provider-logo';
import type { AppLocale } from '@/i18n/routing';
import { formatContext, formatMoney, getProvider } from '@/lib/catalog';
import type { SiteModel } from '@/lib/catalog/live';

/**
 * 模型瀑布流里的单张模型卡（服务端组件），数据来自后台、一律美元，价格取这个模型最便宜的分组：
 * 厂商与名称，下一行厂商 · 上下文（生图写「生图」）；建了监测项的模型写最近一次的对话延迟与端点 PING；
 * 底部文本显示输入单价，按张、按次显示单价。分辨率多档或别的分组更贵（from）时价格后面写「起」。
 */
export function ModelMarqueeCard({ model, from }: { model: SiteModel; from: boolean }) {
  const t = useTranslations('homeMore');
  const tc = useTranslations('common');
  const tm = useTranslations('models');
  const locale = useLocale() as AppLocale;

  const providerName = model.provider ? getProvider(model.provider).name : null;
  const detail =
    model.type === 'image'
      ? t('catalog.image')
      : model.contextTokens !== null
        ? formatContext(model.contextTokens)
        : null;
  const meta = [providerName, detail].filter(Boolean).join(' · ');

  const { price } = model;
  const fromPrice = from || (price.kind === 'request' && price.from);
  let priceText = '';
  if (price.kind === 'token' && price.input !== null) {
    const amount = `${formatMoney(price.input)} ${tc('units.perMTokens')}`;
    priceText = fromPrice
      ? t('catalog.inputFrom', { price: amount })
      : `${t('catalog.input')} ${amount}`;
  } else if (price.kind === 'request') {
    const unit = price.unit === 'image' ? tc('units.perImage') : tc('units.perRequest');
    const amount = `${formatMoney(price.price)} ${unit}`;
    priceText = fromPrice ? tc('units.fromPrice', { price: amount }) : amount;
  }

  const health = model.health;

  return (
    <article
      data-model-card={model.id}
      className="w-full rounded-2xl border border-border bg-card p-6 shadow-card"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
          {model.provider ? <ProviderLogo provider={model.provider} size={20} /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{model.name}</p>
          {meta ? <p className="truncate text-xs text-subtle-foreground">{meta}</p> : null}
        </div>
      </div>
      {health && (health.latencyMs !== null || health.pingMs !== null) ? (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
          {health.latencyMs !== null ? (
            <span>
              {tm('card.latency')} {Math.round(health.latencyMs)} ms
            </span>
          ) : null}
          {health.pingMs !== null ? (
            <span>
              {tm('card.ping')} {Math.round(health.pingMs)} ms
            </span>
          ) : null}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs">
        <span className="truncate tabular-nums text-foreground">{priceText}</span>
        <DiscountBadge discount={model.discount} locale={locale} />
      </div>
    </article>
  );
}

export default ModelMarqueeCard;
