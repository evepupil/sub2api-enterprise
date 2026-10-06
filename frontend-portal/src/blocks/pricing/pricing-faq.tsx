import { useTranslations } from 'next-intl';

import { FaqList } from '@/components/ui/faq-list';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { SITE } from '@/lib/site';

/** 常见问题：左栏标题加联系客服，右栏手风琴（同时只展开一条，展开逻辑在共享组件里）。 */
export function PricingFaq() {
  const t = useTranslations('pricing');
  const c = useTranslations('common');

  const items = [
    { q: t('faq.items.q1'), a: t('faq.items.a1') },
    { q: t('faq.items.q2'), a: t('faq.items.a2') },
    { q: t('faq.items.q3'), a: t('faq.items.a3') },
    { q: t('faq.items.q4'), a: t('faq.items.a4') },
    { q: t('faq.items.q5'), a: t('faq.items.a5') },
    { q: t('faq.items.q6'), a: t('faq.items.a6') },
  ];

  return (
    <section id="faq" className="bg-surface py-20 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div className="lg:self-start">
          <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            {t('faq.title')}
          </h2>
          <div className="mt-6">
            <a
              href={`mailto:${SITE.supportEmail}`}
              data-faq-contact
              className={buttonClass({ variant: 'secondary' })}
            >
              {c('actions.contactSupport')}
            </a>
          </div>
        </div>
        <FaqList items={items} />
      </Container>
    </section>
  );
}

export default PricingFaq;
