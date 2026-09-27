import * as React from 'react';

import { cn } from '../../lib/utils';

/** 未传 name 时使用的临时默认站名。 */
const DEFAULT_BRAND_NAME = '模型服务';

/**
 * 临时品牌：菱形示意标志 + 站名文本。
 * 传 href 时渲染为链接，否则渲染为普通文本块（如侧向菜单顶部）。
 * name 为纯文本，按文本渲染；不读取 site_logo，也不执行任何 HTML。
 * 标志为占位示意，不视为正式品牌标志。
 */
export interface BrandProps extends Omit<React.ComponentProps<'a'>, 'href' | 'children'> {
  href?: string;
  /** 站名纯文本，缺省为“模型服务”；过长时换行或截断，不撑破外壳。 */
  name?: string;
}

function BrandMark({ name }: { name: string }) {
  return (
    <span
      data-slot="brand"
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-2 text-base font-semibold text-foreground',
      )}
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
      <span className="min-w-0 break-words line-clamp-2">{name}</span>
    </span>
  );
}

export function Brand({ href, name, className, ...props }: BrandProps) {
  const label = name === undefined || name.trim() === '' ? DEFAULT_BRAND_NAME : name;
  if (href === undefined) {
    return <BrandMark name={label} />;
  }
  return (
    <a
      href={href}
      data-slot="brand-link"
      className={cn(
        'inline-flex min-w-0 max-w-full rounded-control outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <BrandMark name={label} />
    </a>
  );
}
