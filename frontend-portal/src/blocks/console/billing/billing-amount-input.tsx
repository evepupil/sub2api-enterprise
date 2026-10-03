import type { InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * 美元金额输入框：数字输入，左侧固定一个「$」前缀。
 * 隐藏浏览器自带的上下箭头（滚轮和箭头会让金额悄悄变动），其余行为沿用 Input。
 * 外层 flex-1：放在横排里（如「最小 – 最大」）时平分宽度，竖排时不起作用。
 */
export function AmountInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className="relative min-w-0 flex-1">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground"
      >
        $
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        className={cn(
          'pl-7 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}
