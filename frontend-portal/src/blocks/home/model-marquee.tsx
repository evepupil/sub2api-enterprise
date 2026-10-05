import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { ModelMarqueeCard } from '@/blocks/home/model-marquee-card';
import { Link } from '@/i18n/navigation';
import { Marquee } from '@/components/effects/marquee';
import { SectionHeading } from '@/components/ui/section-heading';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { filterSiteModels, type SiteModel } from '@/lib/catalog/live';
import { cn } from '@/lib/utils';

/** 三列的滚动方向与一圈时长（照规格：up 42s / down 50s / up 46s） */
const COLUMNS: readonly { direction: 'up' | 'down'; duration: number }[] = [
  { direction: 'up', duration: 42 },
  { direction: 'down', duration: 50 },
  { direction: 'up', duration: 46 },
];

/**
 * 首页「N 个模型，持续上新」：共享通道的模型（来自后台，页面读好后传进来）三列竖向滚动。
 * 后台读不到或没有模型时整块不显示。
 */
/** 一列至少这么多张卡，滚动时才不会露出空档 */
const MIN_COLUMN_CARDS = 4;

/**
 * 第 c 列的卡片：模型够多时按 i % 3 轮流分到三列；太少时每列都放全部模型（错开起点），
 * 还不够就重复几遍，保证一列至少 4 张。
 */
function marqueeColumn(models: readonly SiteModel[], c: number): SiteModel[] {
  if (models.length >= MIN_COLUMN_CARDS * COLUMNS.length) {
    return models.filter((_, i) => i % COLUMNS.length === c);
  }
  const offset = Math.floor((models.length * c) / COLUMNS.length);
  const rotated = [...models.slice(offset), ...models.slice(0, offset)];
  const times = Math.ceil(MIN_COLUMN_CARDS / rotated.length);
  return Array.from({ length: times }, () => rotated).flat();
}

export function ModelMarquee({ models: source }: { models: readonly SiteModel[] | null }) {
  const t = useTranslations('homeMore');
  if (source === null || source.length === 0) return null;
  // 最新在前的完整列表，再按 i % 3 轮流分到三列
  const models = filterSiteModels(source, {
    type: 'all',
    providers: [],
    context: 'all',
    query: '',
    sort: 'latest',
  });
  const columns = COLUMNS.map((_, c) => marqueeColumn(models, c));

  return (
    <section id="catalog" className="relative py-20 md:py-28">
      <Container>
        <SectionHeading
          title={t('catalog.title', { count: models.length })}
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
                  {column.map((model, index) => (
                    <ModelMarqueeCard key={`${model.id}-${index}`} model={model} />
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
