'use client';

import { useTranslations } from 'next-intl';

import { Container } from '@/components/ui/container';
import { distinctModelCount, type SiteCatalog } from '@/lib/catalog/live';

import { ImagePriceTable } from './pricing-tables-image';
import { TextPriceTable } from './pricing-tables-text';

/**
 * 价格页价目表：文本与生图两张大表，每个模型在各分组的实付价各占一行（来自后台，官网服务器读好后传进来）。
 * 价格只写美元（充值比例写在页首）；跳转标签上的数量按不重复的模型算。
 * 后台读不到时只写一句「暂时没有可展示的价格」。
 */
export function PricingTables({ catalog }: { catalog: SiteCatalog }) {
  const t = useTranslations('pricing');

  if (catalog === null || catalog.length === 0) {
    return (
      <section id="price-list" className="pb-16 md:pb-20">
        <Container>
          <div
            data-prices-unavailable
            className="rounded-2xl border border-dashed border-border-strong px-6 py-20 text-center text-base text-muted-foreground"
          >
            {t('tables.unavailable')}
          </div>
        </Container>
      </section>
    );
  }

  const textModels = catalog.filter((model) => model.type === 'text');
  const imageModels = catalog.filter((model) => model.type === 'image');
  const nav = [
    {
      id: 'text',
      href: '#text-models',
      label: t('tables.text'),
      count: distinctModelCount(textModels),
    },
    {
      id: 'image',
      href: '#image-models',
      label: t('tables.image'),
      count: distinctModelCount(imageModels),
    },
  ].filter((item) => item.count > 0);

  return (
    <section id="price-list" className="pb-16 md:pb-20">
      <Container className="space-y-16">
        <div className="border-b border-border pb-6">
          <nav aria-label={t('tables.jump')} className="flex gap-2">
            {nav.map((item) => (
              <a
                key={item.id}
                href={item.href}
                data-price-nav={item.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground shadow-card hover:bg-muted"
              >
                {item.label}
                <span className="tabular-nums text-subtle-foreground">{item.count}</span>
              </a>
            ))}
          </nav>
        </div>
        {textModels.length > 0 ? <TextPriceTable models={textModels} /> : null}
        {imageModels.length > 0 ? <ImagePriceTable models={imageModels} /> : null}
      </Container>
    </section>
  );
}

export default PricingTables;
