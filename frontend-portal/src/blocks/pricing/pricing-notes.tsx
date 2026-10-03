import { Coins, Image as ImageIcon, ImagePlus, Layers, Percent, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { IMAGE_TOKENS_PER_IMAGE, USD_CNY_RATE } from '@/lib/catalog';
import { Container } from '@/components/ui/container';

/** 计费说明：六条小卡，两列网格。金额口径、汇率与版本倍率都在这里讲清楚。 */
export function PricingNotes() {
  const t = useTranslations('pricing');

  // 富文本那条：分组页是站内链接，用 t.rich 渲染成 Link
  const editions = t.rich('notes.editions', {
    link: (chunks) => (
      <Link href="/groups" className="font-medium text-foreground underline underline-offset-4">
        {chunks}
      </Link>
    ),
    rate: USD_CNY_RATE,
  });

  return (
    <section id="notes" className="pb-20 md:pb-28">
      <Container>
        <h2 className="text-2xl font-medium tracking-tight text-foreground">{t('notes.title')}</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          <li
            data-note="unit"
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
          >
            <Coins className="mt-1 size-4 shrink-0 text-foreground" />
            <span>{t('notes.unit')}</span>
          </li>
          <li
            data-note="estimate"
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
          >
            <ImageIcon className="mt-1 size-4 shrink-0 text-foreground" />
            <span>{t('notes.estimate', { tokens: String(IMAGE_TOKENS_PER_IMAGE) })}</span>
          </li>
          <li
            data-note="longContext"
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
          >
            <Layers className="mt-1 size-4 shrink-0 text-foreground" />
            <span>{t('notes.longContext')}</span>
          </li>
          <li
            data-note="edit"
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
          >
            <ImagePlus className="mt-1 size-4 shrink-0 text-foreground" />
            <span>{t('notes.edit')}</span>
          </li>
          <li
            data-note="currency"
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
          >
            <Wallet className="mt-1 size-4 shrink-0 text-foreground" />
            <span>{t('notes.currency', { rate: USD_CNY_RATE })}</span>
          </li>
          <li
            data-note="editions"
            className="flex gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground"
          >
            <Percent className="mt-1 size-4 shrink-0 text-foreground" />
            <span>{editions}</span>
          </li>
        </ul>
      </Container>
    </section>
  );
}

export default PricingNotes;
