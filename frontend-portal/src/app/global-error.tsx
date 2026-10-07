'use client';

import './globals.css';

/**
 * 最外层兜底：语言布局本身出错时，页面框架和文案都用不了，这里自带 <html>，中英文各写一句。
 * 正常情况下走不到这里，页面出错由各级 error.tsx 处理。
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center font-sans text-foreground antialiased">
        <h1 className="text-2xl font-medium tracking-tight">页面出错了 · Something went wrong</h1>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          重试 · Try again
        </button>
      </body>
    </html>
  );
}
