'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { CheckList } from '@/components/ui/check-list';
import { buttonClass } from '@/components/ui/button-styles';
import { formatRatio, getEdition, localize, type EditionId, type Group } from '@/lib/catalog';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/navigation';

/** 普通卡就是白底上的文字（模板同款），重点卡用深蓝渐变加颗粒和投影 */
const CARD: Record<'plain' | 'featured', string> = {
  plain: 'relative flex h-full flex-col rounded-2xl p-6 md:p-8',
  featured:
    'relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-navy to-navy-2 p-6 text-navy-foreground shadow-featured md:p-8',
};

const NAME_COLOR: Record<'plain' | 'featured', string> = {
  plain: 'text-foreground',
  featured: 'text-white',
};

const RATIO_COLOR: Record<'plain' | 'featured', string> = {
  plain: 'text-foreground',
  featured: 'text-white',
};

const DESC_COLOR: Record<'plain' | 'featured', string> = {
  plain: 'text-muted-foreground',
  featured: 'text-navy-muted',
};

const SUFFIX_COLOR: Record<'plain' | 'featured', string> = {
  plain: 'text-muted-foreground',
  featured: 'text-navy-muted',
};

/** 单张分组卡：倍率、说明、特权清单、底部整宽按钮，四张卡等高、按钮靠底对齐。 */
export function GroupCardsCard({ group, edition }: { group: Group; edition: EditionId }) {
  const t = useTranslations('groups');
  const common = useTranslations('common');
  const locale = useLocale();
  const ed = getEdition(edition);
  const variant: 'plain' | 'featured' = group.featured ? 'featured' : 'plain';

  // 特权清单前五条来自版本指标，最后接本分组独有的 extras
  const items: ReactNode[] = [
    localize(group.scope, locale),
    localize(ed.channel, locale),
    t('cards.sla', { value: ed.slaTarget.toFixed(1) }),
    group.ratio === null
      ? t('cards.customLimits')
      : t('cards.rpm', { value: ed.rpm.toLocaleString('en-US') }),
    t('cards.support', { hours: ed.supportHours }),
    ...group.extras.map((extra) => localize(extra, locale)),
  ];

  return (
    <article
      data-group-card={group.id}
      data-featured={group.featured ? 'true' : 'false'}
      className={CARD[variant]}
    >
      {group.featured ? (
        // 颗粒质感层：压在渐变上、垫在内容下
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay"
        />
      ) : null}
      <div className="relative flex items-center justify-between gap-2">
        <h3 className={cn('text-base font-semibold', NAME_COLOR[variant])}>
          {localize(group.name, locale)}
        </h3>
        {group.featured ? <Badge tone="inverse">{t('cards.popular')}</Badge> : null}
      </div>
      <div className="relative mt-6 flex items-baseline gap-2">
        <span
          data-group-ratio={group.id}
          className={cn(
            'text-4xl font-semibold tracking-tight tabular-nums md:text-5xl',
            RATIO_COLOR[variant],
          )}
        >
          {formatRatio(group.ratio, locale)}
        </span>
        {group.ratio !== null ? (
          <span className={cn('text-sm', SUFFIX_COLOR[variant])}>{t('cards.ratioSuffix')}</span>
        ) : null}
      </div>
      <p className={cn('relative mt-4 min-h-10 text-sm', DESC_COLOR[variant])}>
        {localize(group.description, locale)}
      </p>
      <CheckList
        className="relative mt-8"
        tone={group.featured ? 'inverse' : 'default'}
        items={items}
      />
      <div className="relative mt-auto pt-8">
        {group.cta === 'contact' ? (
          <a
            href="#"
            data-group-cta={group.id}
            className={buttonClass({ variant: 'secondary', block: true })}
          >
            {common('actions.contactSales')}
          </a>
        ) : (
          <Link
            href="/register"
            data-group-cta={group.id}
            className={buttonClass({
              variant: group.featured ? 'inverse' : 'primary',
              block: true,
            })}
          >
            {t('cards.use')}
          </Link>
        )}
      </div>
    </article>
  );
}
