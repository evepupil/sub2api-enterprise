import * as React from 'react';

import { marketingContent } from '../../content/marketing';
import { cn } from '../../lib/utils';

/** 未传 name 或仍是旧默认站名时，映射到本次授权的临时品牌。 */
const LEGACY_DEFAULT_BRAND_NAME = '模型服务';
const DEFAULT_BRAND_NAME = marketingContent.brand.name;

/**
 * 解析展示用站名：空值与旧默认“模型服务”映射到临时品牌 Nexus API，
 * 已配置的自定义站名原样返回（去空白）。供 Brand 与页脚共用同一规则。
 */
export function resolveBrandName(name?: string): string {
  const trimmed = name?.trim() ?? '';
  if (trimmed === '' || trimmed === LEGACY_DEFAULT_BRAND_NAME) {
    return DEFAULT_BRAND_NAME;
  }
  return trimmed;
}

/**
 * 品牌：自绘几何 “N” 标记 + 站名文本。
 *
 * - 未配置或仍为旧默认“模型服务”时，显示临时品牌 Nexus API。
 * - 已配置自定义站名时原样显示（纯文本，不执行 HTML），过长自然换行。
 * - 传 href 时渲染为链接，否则渲染为普通文本块（如手机菜单顶部）。
 * - 不读取 site_logo，标志为本次授权的临时几何标记。
 */
export interface BrandProps extends Omit<React.ComponentProps<'a'>, 'href' | 'children'> {
  href?: string;
  /** 站名纯文本；缺省或旧默认值映射为 Nexus API。 */
  name?: string;
}

/** 自绘 “N” 标记：两条竖线加一条对角折线，青蓝主色。 */
function BrandMark({ name }: { name: string }) {
  return (
    <span
      data-slot="brand"
      className="inline-flex min-w-0 max-w-full items-center gap-2 text-base font-semibold text-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6 shrink-0 text-primary"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="1.25"
          y="1.25"
          width="21.5"
          height="21.5"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        <path
          d="M8 17V7l8 10V7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="min-w-0 line-clamp-2 break-words">{name}</span>
    </span>
  );
}

export function Brand({ href, name, className, ...props }: BrandProps) {
  const label = resolveBrandName(name);
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
