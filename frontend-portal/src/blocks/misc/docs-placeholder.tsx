import { BookOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { GridBeams } from '@/components/effects/grid-beams';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';

/** 文档入口占位页：干净的图标、标题和两个站内跳转按钮。 */
export async function DocsPlaceholder() {
  const t = await getTranslations('misc');
  const tCommon = await getTranslations('common');

  return (
    <section id="docs" className="relative overflow-hidden py-32 md:py-40">
      <GridBeams />
      <Container className="relative flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
          <BookOpen className="size-6 text-foreground" aria-hidden />
        </div>
        <h1 className="mt-8 text-3xl font-medium tracking-tight text-foreground md:text-5xl">
          {t('docs.title')}
        </h1>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/models" className={buttonClass()}>
            {tCommon('actions.viewModels')}
          </Link>
          <Link href="/pricing" className={buttonClass({ variant: 'secondary' })}>
            {tCommon('actions.viewPricing')}
          </Link>
        </div>
      </Container>
    </section>
  );
}

export default DocsPlaceholder;
