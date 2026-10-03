import { ArrowRight, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';

/** 倍率按合同定制的版本（企业版）没有公开单价：价目表的位置换成一张联系销售卡。 */
export function PricingCustom() {
  const t = useTranslations('pricing');
  const common = useTranslations('common');

  return (
    <section id="price-list" className="pb-16 md:pb-20">
      <Container>
        <div
          data-price-custom
          className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-card md:px-12"
        >
          <Building2 aria-hidden className="size-6 text-foreground" />
          <h2 className="mt-4 text-2xl font-medium tracking-tight text-foreground">
            {t('custom.title')}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {t('custom.desc')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {/* 联系销售为占位链接 */}
            <a href="#" data-price-contact className={buttonClass()}>
              {common('actions.contactSales')}
            </a>
            <Link href="/groups" className={buttonClass({ variant: 'secondary' })}>
              {t('custom.compare')}
              <ArrowRight />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default PricingCustom;
