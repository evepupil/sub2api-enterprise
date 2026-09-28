'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';
import { useSurfaceArea } from './surface';

/**
 * 对话框：组合方式参考 shadcn/ui 对 Radix Dialog 的封装，样式使用
 * tokens.css 语义令牌。Portal、遮罩、Escape、焦点捕获与归还由 Radix
 * 原语负责；标题必须通过 DialogTitle 关联，否则 Radix 会给出警告。
 *
 * 移动端导航会复用 DialogContent 并把 className 覆盖为侧栏样式，
 * 因此 className 始终通过 cn 合并到末尾。
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-foreground/40',
        'transition-opacity duration-150 motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  );
}

export interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** 是否显示右上角关闭按钮；侧栏等自定义容器可关闭。 */
  showCloseButton?: boolean;
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const surface = useSurfaceArea();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-surface={surface}
        className={cn(
          // 默认居中面板：宽屏 480px，窄屏左右各保留 16px 边距。
          'fixed inset-x-4 top-1/2 z-50 mx-auto w-auto -translate-y-1/2',
          'max-w-dialog rounded-dialog border border-border bg-card p-6 text-card-foreground shadow-overlay outline-none',
          // 内容随视口高度收缩并可滚动。
          'max-h-[calc(100dvh-2rem)] overflow-y-auto',
          'transition-opacity duration-150 motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              'absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-control text-muted-foreground transition-colors duration-150 outline-none md:size-8',
              'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 pr-12 text-left md:pr-8', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('mt-6 flex flex-col-reverse gap-2 md:flex-row md:justify-end', className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-semibold text-card-foreground', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
