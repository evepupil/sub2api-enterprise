import { ArrowRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '../ui/button';

/**
 * 营销链接按钮：复用现有 Button，只负责把链接渲染成单个 <a>，
 * 不在内部再包一层 button，也不会嵌套 a。
 *
 * 契约来源：design/proactiv-redesign.md 第 3 节。
 * - variant='default' 为主按钮（青蓝），'outline' 为描边次按钮。
 * - arrow 为 true 时在文字后加 ArrowRight 图标（纯装饰，aria-hidden）。
 */
export interface MarketingLinkProps extends Omit<
  React.ComponentProps<'a'>,
  'href' | 'children' | 'className'
> {
  href: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  /** 是否显示右箭头图标；仅作视觉引导，不改变可访问名称。 */
  arrow?: boolean;
  className?: string;
}

export function MarketingLink({
  href,
  children,
  variant = 'default',
  arrow = false,
  className,
  ...props
}: MarketingLinkProps) {
  return (
    <Button asChild variant={variant} className={className}>
      <a href={href} {...props}>
        <span className="min-w-0">{children}</span>
        {arrow ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
      </a>
    </Button>
  );
}
