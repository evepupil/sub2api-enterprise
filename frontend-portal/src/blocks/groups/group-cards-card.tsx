import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { CheckList } from '@/components/ui/check-list';
import { buttonClass } from '@/components/ui/button-styles';
import { formatRatio, GROUP_HIGHLIGHTS, localize, type Edition } from '@/lib/catalog';
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

/**
 * 单张分组卡（一个版本）：倍率、说明、特权清单、底部整宽按钮，三张卡等高、按钮靠底对齐。
 * previous 是上一档版本，清单第一条写「包含上一档全部特权」（模板同款写法）。
 */
export function GroupCardsCard({ edition, previous }: { edition: Edition; previous?: Edition }) {
  const t = useTranslations('groups');
  const common = useTranslations('common');
  const locale = useLocale();
  const variant: 'plain' | 'featured' = edition.featured ? 'featured' : 'plain';

  // 清单：上一档全部特权 → 渠道 → 可用率 → 限额 → 工单 → 本版本独有的几条
  const items: ReactNode[] = [
    ...(previous ? [t('cards.includes', { edition: localize(previous.name, locale) })] : []),
    localize(edition.channel, locale),
    t('cards.sla', { value: edition.slaTarget.toFixed(1) }),
    edition.ratio === null
      ? t('cards.customLimits')
      : t('cards.rpm', { value: edition.rpm.toLocaleString('en-US') }),
    t('cards.support', { hours: edition.supportHours }),
    ...GROUP_HIGHLIGHTS[edition.id].map((item) => localize(item, locale)),
  ];

  return (
    <article
      data-group-card={edition.id}
      data-featured={edition.featured ? 'true' : 'false'}
      className={CARD[variant]}
    >
      {edition.featured ? (
        // 颗粒质感层：压在渐变上、垫在内容下
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay"
        />
      ) : null}
      <div className="relative flex items-center justify-between gap-2">
        <h3 className={cn('text-base font-semibold', NAME_COLOR[variant])}>
          {localize(edition.name, locale)}
        </h3>
        {edition.featured ? <Badge tone="inverse">{t('cards.popular')}</Badge> : null}
      </div>
      <div className="relative mt-6 flex items-baseline gap-2">
        <span
          data-group-ratio={edition.id}
          className={cn(
            'text-4xl font-semibold tracking-tight tabular-nums md:text-5xl',
            RATIO_COLOR[variant],
          )}
        >
          {formatRatio(edition.ratio, locale)}
        </span>
        {edition.ratio !== null ? (
          <span className={cn('text-sm', SUFFIX_COLOR[variant])}>{t('cards.ratioSuffix')}</span>
        ) : null}
      </div>
      <p className={cn('relative mt-4 min-h-10 text-sm', DESC_COLOR[variant])}>
        {localize(edition.summary, locale)}
      </p>
      <CheckList
        className="relative mt-8"
        tone={edition.featured ? 'inverse' : 'default'}
        items={items}
      />
      <div className="relative mt-auto pt-8">
        {edition.cta === 'contact' ? (
          // 联系销售为占位链接
          <a
            href="#"
            data-group-cta={edition.id}
            className={buttonClass({ variant: 'secondary', block: true })}
          >
            {common('actions.contactSales')}
          </a>
        ) : (
          <Link
            href="/register"
            data-group-cta={edition.id}
            className={buttonClass({
              variant: edition.featured ? 'inverse' : 'primary',
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
