import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { ModelMarqueeCard } from '@/blocks/home/model-marquee-card';
import { Link } from '@/i18n/navigation';
import { Marquee } from '@/components/effects/marquee';
import { SectionHeading } from '@/components/ui/section-heading';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { DEFAULT_FILTER, MODELS, filterModels, type Model } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** 三列的滚动方向与一圈时长（照规格：up 42s / down 50s / up 46s） */
const COLUMNS: readonly { direction: 'up' | 'down'; duration: number }[] = [
  { direction: 'up', duration: 42 },
  { direction: 'down', duration: 50 },
  { direction: 'up', duration: 46 },
];

export function ModelMarquee() {
  const t = useTranslations('homeMore');
  // 最新在前的完整列表，再按 i % 3 轮流分到三列
  const models = filterModels(MODELS, DEFAULT_FILTER, 'personal');
  const columns: Model[][] = COLUMNS.map((_, c) => models.filter((_, i) => i % 3 === c));

  return (
    <section id="catalog" className="relative py-20 md:py-28">
      <Container>
        <SectionHeading
          title={t('catalog.title', { count: MODELS.length })}
          subtitle={t('catalog.subtitle')}
        />
        <div className="mt-16 grid h-[640px] grid-cols-1 gap-4 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)] md:grid-cols-2 lg:grid-cols-3">
          {columns.map((column, c) => {
            const meta = COLUMNS[c];
            if (!meta) return null;
            return (
              <div
                key={c}
                className={cn(c === 1 && 'hidden md:block', c === 2 && 'hidden lg:block')}
              >
                <Marquee
                  direction={meta.direction}
                  duration={meta.duration}
                  groupClassName="w-full"
                >
                  {/* 竖向滚动：条目间距用 Marquee 默认的 16px，两份内容首尾相接实现无缝循环 */}
                  {column.map((model) => (
                    <ModelMarqueeCard key={model.id} model={model} />
                  ))}
                </Marquee>
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex justify-center">
          <Link href="/catalog" data-catalog-more className={buttonClass({ variant: 'secondary' })}>
            {t('catalog.more')}
            <ArrowRight />
          </Link>
        </div>
      </Container>
    </section>
  );
}

export default ModelMarquee;
