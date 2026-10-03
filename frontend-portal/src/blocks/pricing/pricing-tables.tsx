'use client';

import { useTranslations } from 'next-intl';

import { editionRatio, MODELS } from '@/lib/catalog';
import { Container } from '@/components/ui/container';
import { useEdition } from '@/lib/use-catalog-state';

import { PricingCustom } from './pricing-custom';
import { CurrencyNote } from './pricing-tables-note';
import { ImagePriceTable } from './pricing-tables-image';
import { TextPriceTable } from './pricing-tables-text';

/**
 * 价格页价目表：文本与生图两张大表。版本、币种从网址参数读取，变化时所有金额整体重算。
 * 倍率按合同定制的版本（企业版）没有公开单价，换成联系销售卡。
 */
export function PricingTables() {
  const t = useTranslations('pricing');
  const [edition] = useEdition();
  const textCount = MODELS.filter((model) => model.type === 'text').length;
  const imageCount = MODELS.filter((model) => model.type === 'image').length;

  if (editionRatio(edition) === null) return <PricingCustom />;

  return (
    <section id="price-list" className="pb-16 md:pb-20">
      <Container className="space-y-16">
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <nav aria-label={t('tables.jump')} className="flex gap-2">
            <a
              href="#text-models"
              data-price-nav="text"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground shadow-card hover:bg-muted"
            >
              {t('tables.text')}
              <span className="tabular-nums text-subtle-foreground">{textCount}</span>
            </a>
            <a
              href="#image-models"
              data-price-nav="image"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground shadow-card hover:bg-muted"
            >
              {t('tables.image')}
              <span className="tabular-nums text-subtle-foreground">{imageCount}</span>
            </a>
          </nav>
          <CurrencyNote />
        </div>
        <TextPriceTable />
        <ImagePriceTable />
      </Container>
    </section>
  );
}

export default PricingTables;
