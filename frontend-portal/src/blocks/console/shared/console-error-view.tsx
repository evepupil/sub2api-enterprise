'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { EmptyState } from '@/components/console/empty-state';

/** 控制台页面出错时：保留侧栏，内容区显示出错和「重试」，有错误编号时附在说明里方便报给客服。 */
export function ConsoleErrorView({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const t = useTranslations('console');

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-6 lg:px-8">
      <EmptyState
        id="console-error"
        icon={TriangleAlert}
        title={t('error.title')}
        description={digest ? t('error.code', { code: digest }) : undefined}
        action={
          <Button data-error-retry onClick={onRetry}>
            {t('error.retry')}
          </Button>
        }
      />
    </div>
  );
}
