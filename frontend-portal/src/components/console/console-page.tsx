import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 页面宽度：default 最宽 1440；narrow 收窄到 768（表单为主的页面，如账户设置） */
type PageWidth = 'default' | 'narrow';

/** 标题行与内容区共用同一个居中容器，宽屏下标题、右侧操作与下面的卡片左右边对齐 */
const CONTAINER: Record<PageWidth, string> = {
  default: 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8',
  narrow: 'mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8',
};

/**
 * 控制台页面骨架：顶部标题行（标题 + 右侧操作，底部一条通栏分隔线）+ 内容区。
 * 按界面文案规则只放标题，不加描述句。
 */
export function ConsolePage({
  id,
  title,
  actions,
  width = 'default',
  children,
  className,
}: {
  /** 页面标识，写在 data-console-page 上，交互检查用 */
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  width?: PageWidth;
  children: ReactNode;
  /** 只加在内容区上 */
  className?: string;
}) {
  return (
    <div data-console-page={id}>
      <header className="border-b border-border">
        <div
          className={cn(
            'flex min-h-16 flex-wrap items-center justify-between gap-3 py-4',
            CONTAINER[width],
          )}
        >
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className={cn('space-y-6 py-6', CONTAINER[width], className)}>{children}</div>
    </div>
  );
}
