import { useTranslations } from 'next-intl';

import { GridBeams } from '@/components/effects/grid-beams';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';

export function HomeCta() {
  const t = useTranslations('homeMore');

  return (
    <section id="get-started" className="relative overflow-hidden py-20 md:py-28">
      <GridBeams />
      <Container className="relative">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-2 px-6 py-16 text-center shadow-featured md:px-16 md:py-24">
          {/* 颗粒纹理 + 顶部高光，营造深色重点卡的质感 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <h2 className="relative text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {t('cta.title')}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-balance text-base text-navy-muted">
            {t('cta.subtitle')}
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              data-cta-primary
              className={buttonClass({ variant: 'inverse', size: 'lg' })}
            >
              {t('cta.primary')}
            </Link>
            <Link
              href="/pricing"
              data-cta-secondary
              className={buttonClass({
                variant: 'ghost',
                size: 'lg',
                className: 'text-white hover:bg-white/10',
              })}
            >
              {t('cta.secondary')}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default HomeCta;
