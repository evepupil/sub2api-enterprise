import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const INPUT_CLASS =
  'h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] placeholder:text-subtle-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/5 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10';

/** 单行输入框。出错时给 aria-invalid="true"，边框和光圈自动变红。 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(INPUT_CLASS, className)} {...props} />;
  },
);
