'use client';

import { ErrorView } from '@/blocks/misc/error-view';

/** 登录注册页（以及官网、控制台的布局本身）渲染出错：整屏居中显示出错页。 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="flex min-h-dvh items-center">
      <ErrorView digest={error.digest} onRetry={reset} className="w-full" />
    </main>
  );
}
