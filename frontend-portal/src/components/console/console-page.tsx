import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * 控制台页面骨架：顶部标题行（标题 + 右侧操作，底部一条分隔线）+ 内容区。
 * 按界面文案规则只放标题，不加描述句。
 */
export function ConsolePage({
  id,
  title,
  actions,
  children,
  className,
}: {
  /** 页面标识，写在 data-console-page 上，交互检查用 */
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-console-page={id}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div
        className={cn(
          'mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
