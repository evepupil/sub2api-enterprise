import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ContainerTag = 'div' | 'section' | 'header' | 'footer' | 'nav';

/** 页面内容容器：最宽 1280px，两侧留白手机 16px、桌面 32px。 */
export function Container({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: ContainerTag;
  className?: string;
  children?: ReactNode;
}) {
  return <Tag className={cn('mx-auto w-full max-w-7xl px-4 md:px-8', className)}>{children}</Tag>;
}
