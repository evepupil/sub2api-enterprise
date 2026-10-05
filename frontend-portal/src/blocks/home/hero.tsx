import { ArrowRight, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';

import { GridBeams } from '@/components/effects/grid-beams';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';

/**
 * 载入动画：四组元素（胶囊、标题、副标题、按钮）依次淡入上移，间隔 80ms。
 * 用纯 CSS 动画而不是 JS：页面 HTML 一到就开始播放，不用等水合，首屏不会出现空白；
 * 系统开启「减少动态效果」时样式表里直接关掉动画。
 */
const delay = (index: number): CSSProperties => ({ animationDelay: `${index * 80}ms` });

export function HomeHero({ count }: { count: number | null }) {
  const t = useTranslations('homeHero');

  return (
    <section id="hero" className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-20">
      <GridBeams />
      <Container className="relative flex flex-col items-center text-center">
        <div className="max-w-full animate-fade-up" style={delay(0)}>
          <Link
            href="/catalog?type=image"
            data-hero-badge
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground shadow-pill transition-colors hover:bg-muted"
          >
            <span className="truncate">{t('badge')}</span>
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
        <div className="animate-fade-up" style={delay(1)}>
          <h1 className="mt-8 max-w-6xl text-balance text-[40px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl lg:leading-none">
            {t('titleLine1')}
            <br className="hidden sm:block" /> {t('titleLine2')}
          </h1>
        </div>
        <div className="animate-fade-up" style={delay(2)}>
          <p className="mx-auto mt-6 max-w-3xl text-balance text-lg text-muted-foreground md:text-xl">
            {count === null
              ? t.rich('subtitleNoCount', { br: () => <br className="hidden md:block" /> })
              : t.rich('subtitle', { count, br: () => <br className="hidden md:block" /> })}
          </p>
        </div>
        <div className="animate-fade-up" style={delay(3)}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <Link href="/register" data-hero-primary className={buttonClass({ size: 'lg' })}>
              {t('primaryCta')}
            </Link>
            <Link
              href="/pricing"
              data-hero-secondary
              className={buttonClass({ variant: 'link', className: 'text-base' })}
            >
              {t('secondaryCta')}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default HomeHero;
