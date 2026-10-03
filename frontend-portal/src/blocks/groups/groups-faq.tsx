import { FaqList } from '@/components/ui/faq-list';
import { Container } from '@/components/ui/container';
import { useTranslations } from 'next-intl';

/** 分组页常见问题：左栏标题，右栏手风琴（展开状态由共享 FaqList 管理）。 */
export function GroupsFaq() {
  const t = useTranslations('groups');

  const items = [
    { q: t('faq.items.q1'), a: t('faq.items.a1') },
    { q: t('faq.items.q2'), a: t('faq.items.a2') },
    { q: t('faq.items.q3'), a: t('faq.items.a3') },
    { q: t('faq.items.q4'), a: t('faq.items.a4') },
    { q: t('faq.items.q5'), a: t('faq.items.a5') },
  ];

  return (
    <section id="faq" className="border-t border-border py-20 md:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:self-start">
          {t('faq.title')}
        </h2>
        <FaqList items={items} />
      </Container>
    </section>
  );
}

export default GroupsFaq;
