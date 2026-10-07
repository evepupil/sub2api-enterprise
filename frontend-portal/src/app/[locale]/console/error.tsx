'use client';

import { ConsoleErrorView } from '@/blocks/console/shared/console-error-view';

/** 控制台页面渲染出错：外壳（侧栏、手机顶栏）还在，内容区换成出错提示和「重试」。 */
export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ConsoleErrorView digest={error.digest} onRetry={reset} />;
}
