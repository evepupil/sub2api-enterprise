import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * 加载占位：浅灰圆角块，轻轻呼吸（系统设置了减少动效时不动）。
 * 数据还没到时代替数字、图表，尺寸由调用方用类名给（高度跟着图表走时可用 style），
 * 和真实内容等高，加载完不跳动。
 */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      data-skeleton
      style={style}
      className={cn(
        'block animate-pulse rounded-md bg-muted motion-reduce:animate-none',
        className,
      )}
    />
  );
}
