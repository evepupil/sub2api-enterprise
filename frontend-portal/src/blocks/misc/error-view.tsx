'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { GridBeams } from '@/components/effects/grid-beams';
import { Button } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * 页面出错时（渲染抛错）：和 404 页同一套版式，图标、一句标题、「重试」和「返回首页」。
 * 服务端出错时 Next.js 给一个错误编号，附在下面方便客户报给客服查日志。
 */
export function ErrorView({
  digest,
  onRetry,
  className,
}: {
  digest?: string;
  onRetry: () => void;
  className?: string;
}) {
  const t = useTranslations('misc');

  return (
    <section
      id="error"
      data-error-view
      className={cn('relative overflow-hidden py-32 md:py-40', className)}
    >
      <GridBeams />
      <Container className="relative flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-card">
          <TriangleAlert aria-hidden className="size-6 text-foreground" />
        </span>
        <h1 className="mt-8 text-2xl font-medium tracking-tight text-foreground">
          {t('error.title')}
        </h1>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button data-error-retry onClick={onRetry}>
            {t('error.retry')}
          </Button>
          <Link href="/" className={buttonClass({ variant: 'secondary' })}>
            {t('error.home')}
          </Link>
        </div>
        {digest ? (
          <p className="mt-6 text-xs text-subtle-foreground">{t('error.code', { code: digest })}</p>
        ) : null}
      </Container>
    </section>
  );
}

export default ErrorView;
