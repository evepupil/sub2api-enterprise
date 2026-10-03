import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/**
 * 控制台表格的几块积木：外框（可带底部分页）、表格、表头格、单元格、行。
 * 宽表在小屏横向滚动；首列或操作列可以固定（sticky），固定格自带不透明底色和分隔阴影。
 */
export function TableShell({
  id,
  children,
  footer,
  className,
}: {
  id: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-table={id}
      className={cn(
        'min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card',
        className,
      )}
    >
      {/* relative：表格里绝对定位的读屏文字也要被这个滚动容器裁住 */}
      <div className="relative overflow-x-auto">{children}</div>
      {footer ? <div className="border-t border-border px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function Table({
  minWidth,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { minWidth?: number }) {
  return (
    <table
      className={cn('w-full border-collapse text-sm', className)}
      style={minWidth ? { minWidth } : undefined}
      {...props}
    />
  );
}

type Align = 'left' | 'right' | 'center';
type Sticky = 'left' | 'right';

const ALIGN: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const STICKY_HEAD: Record<Sticky, string> = {
  left: 'sticky left-0 z-10 shadow-[inset_-1px_0_0_var(--border)]',
  right: 'sticky right-0 z-10 shadow-[inset_1px_0_0_var(--border)]',
};

const STICKY_CELL: Record<Sticky, string> = {
  left: 'sticky left-0 z-10 bg-card shadow-[inset_-1px_0_0_var(--border)] group-hover:bg-surface',
  right: 'sticky right-0 z-10 bg-card shadow-[inset_1px_0_0_var(--border)] group-hover:bg-surface',
};

export function Th({
  align = 'left',
  sticky,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align; sticky?: Sticky }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap bg-surface px-4 py-3 text-xs font-medium text-subtle-foreground',
        ALIGN[align],
        sticky && STICKY_HEAD[sticky],
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  align = 'left',
  sticky,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align; sticky?: Sticky }) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-foreground',
        ALIGN[align],
        sticky && STICKY_CELL[sticky],
        className,
      )}
      {...props}
    />
  );
}

/** 表体行：悬停变浅灰（固定列跟着变，靠 group） */
export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('group border-t border-border transition-colors hover:bg-surface', className)}
      {...props}
    />
  );
}
