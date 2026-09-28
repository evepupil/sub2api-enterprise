'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from '../../lib/utils';
import { useSurfaceArea } from './surface';

/**
 * 气泡层：组合方式参考 shadcn/ui 对 Radix Popover 的封装。内容经 Portal
 * 挂到 body，默认居中于触发器，并由 Radix 的碰撞检测约束在视口内
 * （collisionPadding 保证至少 8px 边距，避免贴边或溢出屏幕）。
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 8,
  collisionPadding = 8,
  avoidCollisions = true,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const surface = useSurfaceArea();

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        data-surface={surface}
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        avoidCollisions={avoidCollisions}
        className={cn(
          'z-50 rounded-card border border-border bg-popover p-4 text-popover-foreground shadow-overlay outline-none',
          // 内容不超过视口：超出时在弹层内部滚动，不撑破屏幕。
          'max-h-[var(--radix-popover-content-available-height)] max-w-[var(--radix-popover-content-available-width)] overflow-auto',
          'transition-opacity duration-150 motion-reduce:transition-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
