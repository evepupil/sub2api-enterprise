import { useLocale, useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Badge } from '@/components/ui/badge';
import {
  editionDiscount,
  formatContext,
  formatMoney,
  getProvider,
  imagePrice,
  isNewModel,
  localize,
  textPrice,
  type Model,
} from '@/lib/catalog';

/**
 * 模型瀑布流里的单张模型卡（服务端组件）。
 * 价格一律按个人版、美元；文本显示输入单价，生图按张显示「起」、按 Token 显示每张估算价。
 */
export function ModelMarqueeCard({ model }: { model: Model }) {
  const t = useTranslations('homeMore');
  const tc = useTranslations('common');
  const locale = useLocale();
  const provider = getProvider(model.provider);

  const text = textPrice(model, 'personal');
  const image = text ? null : imagePrice(model, 'personal');
  const isNew = isNewModel(model);

  // 副行：文本模型显示上下文长度，生图模型显示「生图」
  const meta =
    model.contextTokens !== null
      ? `${provider.name} · ${formatContext(model.contextTokens)}`
      : `${provider.name} · ${t('catalog.image')}`;

  // 底部价格：三种口径都从数据层取，不写死数字
  let price: string;
  if (text) {
    price = `${t('catalog.input')} ${formatMoney(text.input, 'usd')} ${tc('units.perMTokens')}`;
  } else if (image && image.kind === 'per-image') {
    price = `${formatMoney(image.from, 'usd')} ${tc('units.perImage')} ${tc('units.from')}`;
  } else if (image) {
    price = `≈ ${formatMoney(image.estimatedPerImage, 'usd')} ${tc('units.perImage')}`;
  } else {
    price = '';
  }

  return (
    <article
      data-model-card={model.id}
      className="w-full rounded-2xl border border-border bg-card p-6 shadow-card"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
          <ProviderLogo provider={model.provider} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{model.name}</p>
          <p className="truncate text-xs text-subtle-foreground">{meta}</p>
        </div>
        {isNew ? <Badge tone="info">{t('catalog.new')}</Badge> : null}
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
        {localize(model.description, locale)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs">
        <span className="truncate tabular-nums text-foreground">{price}</span>
        <DiscountBadge discount={editionDiscount('personal')} locale={locale} />
      </div>
    </article>
  );
}

export default ModelMarqueeCard;
