import { getTranslations } from 'next-intl/server';

import { GridBeams } from '@/components/effects/grid-beams';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** 404 页：超大 404 数字、一句话说明和返回首页按钮，顶栏页脚由 not-found.tsx 负责。 */
export async function NotFoundView() {
  const t = await getTranslations('misc');

  return (
    <section id="not-found" className="relative overflow-hidden py-32 md:py-40">
      <GridBeams />
      <Container className="relative flex flex-col items-center text-center">
        <p className="text-7xl font-semibold tracking-tight tabular-nums text-foreground md:text-8xl">
          404
        </p>
        <h1 className="mt-6 text-2xl font-medium tracking-tight text-foreground">
          {t('notFound.title')}
        </h1>
        <Link href="/" data-not-found-home className={cn(buttonClass(), 'mt-10')}>
          {t('notFound.home')}
        </Link>
      </Container>
    </section>
  );
}

export default NotFoundView;
