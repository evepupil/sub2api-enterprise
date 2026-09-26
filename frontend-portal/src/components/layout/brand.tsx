import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * 临时品牌：菱形示意标志 + “模型服务”。
 * 传 href 时渲染为链接，否则渲染为普通文本块（如侧向菜单顶部）。
 * 标志为占位示意，不视为正式品牌标志。
 */
export interface BrandProps extends Omit<React.ComponentProps<'a'>, 'href' | 'children'> {
  href?: string;
}

function BrandMark() {
  return (
    <span
      data-slot="brand"
      className={cn('inline-flex items-center gap-2 text-base font-semibold text-foreground')}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0 text-foreground"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="6.35"
          y="6.35"
          width="11.3"
          height="11.3"
          rx="2.5"
          transform="rotate(45 12 12)"
          fill="currentColor"
        />
      </svg>
      <span className="whitespace-nowrap">模型服务</span>
    </span>
  );
}

export function Brand({ href, className, ...props }: BrandProps) {
  if (href === undefined) {
    return <BrandMark />;
  }
  return (
    <a
      href={href}
      data-slot="brand-link"
      className={cn(
        'inline-flex rounded-control outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <BrandMark />
    </a>
  );
}
