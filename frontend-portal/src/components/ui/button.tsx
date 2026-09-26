'use client';

import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import { cn } from '../../lib/utils';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'icon';

/**
 * 样式参考 shadcn/ui Button 的组合方式（variant/size 语义与 Radix Slot 的
 * asChild 契约），颜色与尺寸全部使用本项目语义令牌，非官方代码复制。
 * 移动端触控 44px（h-touch），桌面控件 36px（h-control）。
 */
const buttonVariantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-input bg-card hover:bg-muted',
  ghost: 'hover:bg-muted',
  destructive: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive',
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  default: 'h-touch px-4 md:h-control',
  sm: 'h-touch gap-1.5 px-3 md:h-8',
  // 方形图标按钮：用 aspect-square 从高度推出宽度，桌面回到 36px 控件高度。
  icon: 'h-touch aspect-square px-0 md:h-control',
};

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 渲染为单个子元素（如 Next Link、a）；子元素只能有一个。 */
  asChild?: boolean;
  /** 加载中：保留尺寸与内容，阻止重复触发，声明 aria-busy。 */
  loading?: boolean;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  type,
  onClick,
  onClickCapture,
  'aria-disabled': ariaDisabled,
  'aria-busy': ariaBusy,
  children,
  ...props
}: ButtonProps) {
  const inert = disabled === true || loading;
  const classes = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors duration-150 outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className,
  );

  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<
      React.HTMLAttributes<HTMLElement>
    >;
    // Slot 会先执行子元素的同名事件。把守卫放到子元素的捕获阶段，
    // 确保禁用或加载时，子元素自己的业务回调也不会先执行。
    const guardedChild = React.cloneElement(child, {
      tabIndex: inert ? -1 : child.props.tabIndex,
      'aria-disabled': inert ? true : (child.props['aria-disabled'] ?? ariaDisabled),
      'aria-busy': loading ? true : (child.props['aria-busy'] ?? ariaBusy),
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (inert) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        child.props.onClickCapture?.(event);
        if (!event.defaultPrevented) {
          onClickCapture?.(event as React.MouseEvent<HTMLButtonElement>);
        }
      },
    });
    return (
      <Slot
        data-slot="button"
        data-variant={variant}
        data-size={size}
        data-loading={loading || undefined}
        data-disabled={inert || undefined}
        aria-busy={loading ? true : ariaBusy}
        aria-disabled={inert ? true : ariaDisabled}
        className={classes}
        onClick={(event: React.MouseEvent<HTMLElement>) => {
          if (inert) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event as React.MouseEvent<HTMLButtonElement>);
        }}
        {...props}
      >
        {guardedChild}
      </Slot>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      type={type ?? 'button'}
      disabled={inert}
      aria-busy={loading ? true : ariaBusy}
      aria-disabled={inert ? true : ariaDisabled}
      className={classes}
      onClick={onClick}
      onClickCapture={onClickCapture}
      {...props}
    >
      {children}
    </button>
  );
}
