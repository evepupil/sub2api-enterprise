import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** 与单行输入框同一套外观：边框、聚焦光圈、出错变红（aria-invalid="true"），不能拖拽改大小 */
const TEXTAREA_CLASS =
  'block w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] placeholder:text-subtle-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/5 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10';

/**
 * 带底栏时外框画在外层，里面是无边框的输入区，下面一条底栏（放字数等）。
 * 输入区自己滚动，文字不会滚到底栏下面；聚焦光圈与出错红框由外层承担（focus-within、has 选择器）。
 */
const FRAMED_CLASS =
  'rounded-md border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:border-border-strong focus-within:ring-4 focus-within:ring-foreground/5 has-[textarea[aria-invalid=true]]:border-danger has-[textarea[aria-invalid=true]]:ring-danger/10';

const FRAMED_INNER_CLASS =
  'block w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * 多行输入框。传 footer（如字数）时输入框下面带一条底栏；不传就是普通的多行输入框。
 * 出错时给 aria-invalid="true"，边框和光圈自动变红。
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { footer?: ReactNode }
>(function Textarea({ className, footer, ...props }, ref) {
  if (footer === undefined) {
    return <textarea ref={ref} className={cn(TEXTAREA_CLASS, className)} {...props} />;
  }
  return (
    <div className={FRAMED_CLASS}>
      <textarea ref={ref} className={cn(FRAMED_INNER_CLASS, className)} {...props} />
      <div className="flex justify-end px-3 pb-2 text-xs tabular-nums text-subtle-foreground">
        {footer}
      </div>
    </div>
  );
});
