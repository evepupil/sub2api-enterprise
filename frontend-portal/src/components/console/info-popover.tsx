'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 鼠标从图标移到卡片之间有一小段空隙，稍等再收，避免一移开就闪没 */
const CLOSE_DELAY_MS = 120;

/**
 * 小「i」图标 + 悬浮说明卡片（如日志页费用旁的费用明细）。卡片里只放说明，不放可点的东西。
 * - 鼠标移上去就显示，移开就收起；点一下固定住，再点一下或点别处、按 Esc 收起。
 * - 触屏点一下打开，再点一下或点别处收起；键盘聚焦后回车、空格开关。
 * 卡片放进 Portal，不会被表格的横向滚动框裁掉。默认在图标下方、右边对齐图标（和控制台其他弹出层一样往下开）：
 * 下方放不下时翻到上方，左右靠边时自动挪回屏幕内（放左右两侧时窄屏会挪不回来，所以不用）。
 */
export function InfoPopover({
  name,
  label,
  align = 'end',
  className,
  children,
}: {
  /** 交互检查用：图标是 data-info-popover，卡片是 data-info-popover-panel */
  name: string;
  /** 图标按钮的读屏文字，如「查看费用明细」 */
  label: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // 点过以后固定住：鼠标移开也不收
  const pinned = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hideSoon = () => {
    if (pinned.current) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const isMouse = (event: React.PointerEvent) => event.pointerType === 'mouse';

  useEffect(() => {
    const timer = closeTimer;
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          pinned.current = false;
          cancelClose();
        }
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          data-info-popover={name}
          onPointerEnter={(event) => {
            if (isMouse(event)) show();
          }}
          onPointerLeave={(event) => {
            if (isMouse(event)) hideSoon();
          }}
          onClick={(event) => {
            // 不用 Radix 自带的开关：悬停已经打开时，点一下是固定住，不是关掉
            event.preventDefault();
            if (open && pinned.current) {
              pinned.current = false;
              setOpen(false);
            } else {
              pinned.current = true;
              show();
            }
          }}
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground',
            className,
          )}
        >
          <Info aria-hidden className="size-3.5" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align={align}
          sideOffset={6}
          collisionPadding={12}
          data-info-popover-panel={name}
          // 卡片里没有可点的东西，焦点留在图标上
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerEnter={(event) => {
            if (isMouse(event)) cancelClose();
          }}
          onPointerLeave={(event) => {
            if (isMouse(event)) hideSoon();
          }}
          className="z-50 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card px-4 py-3 text-foreground shadow-card"
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
