import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Direction = 'left' | 'right' | 'up' | 'down';

type TrackStyle = CSSProperties & { '--marquee-duration': string };

/**
 * 跑马灯：轨道里放两份相同的内容，整体平移一半正好首尾相接。
 * 横向用 left / right，纵向用 up / down（纵向要在 className 里给容器定高度）。
 * 减少动态效果时由全局样式停住，不需要在这里处理。
 */
export function Marquee({
  children,
  direction = 'left',
  duration = 40,
  gap = 16,
  pauseOnHover = true,
  className,
  groupClassName,
}: {
  children: ReactNode;
  direction?: Direction;
  /** 走完一圈的秒数 */
  duration?: number;
  /** 条目之间的间距，单位 px */
  gap?: number;
  pauseOnHover?: boolean;
  className?: string;
  /** 加在两份内容各自外层的类名 */
  groupClassName?: string;
}) {
  const vertical = direction === 'up' || direction === 'down';
  const reverse = direction === 'right' || direction === 'down';

  const trackStyle: TrackStyle = { '--marquee-duration': `${duration}s` };
  // 每份内容结尾补一个间距，两份之间的空隙才和条目之间一样大
  const groupStyle: CSSProperties = vertical
    ? { gap, paddingBottom: gap }
    : { gap, paddingRight: gap };

  const group = (hidden: boolean) => (
    <div
      aria-hidden={hidden ? true : undefined}
      className={cn(vertical ? 'flex flex-col' : 'flex shrink-0', groupClassName)}
      style={groupStyle}
    >
      {children}
    </div>
  );

  return (
    <div className={cn('group/marquee overflow-hidden', className)}>
      <div
        data-marquee-track
        className={cn(
          vertical ? 'flex w-full flex-col animate-marquee-y' : 'flex w-max animate-marquee-x',
          reverse && '[animation-direction:reverse]',
          pauseOnHover && 'group-hover/marquee:[animation-play-state:paused]',
        )}
        style={trackStyle}
      >
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}
