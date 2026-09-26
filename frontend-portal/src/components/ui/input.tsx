import * as React from 'react';

import { cn } from '../../lib/utils';

/** 文本输入框：接收原生 input 属性，支持 aria-invalid 与 disabled。 */
export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-touch w-full min-w-0 rounded-control border border-input bg-card px-3 text-base text-foreground transition-colors duration-150 outline-none',
        'placeholder:text-muted-foreground md:h-control md:text-sm',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
        'aria-invalid:border-destructive aria-invalid:ring-destructive',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
