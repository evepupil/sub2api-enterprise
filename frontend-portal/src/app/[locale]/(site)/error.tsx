'use client';

import { ErrorView } from '@/blocks/misc/error-view';

/** 官网页面渲染出错：顶栏、页脚还在，中间换成出错页（重试、返回首页）。 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView digest={error.digest} onRetry={reset} />;
}
