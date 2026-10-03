'use client';

import { cn } from '@/lib/utils';

/** 开关：role="switch"，键盘空格 / 回车可切换（原生按钮行为）。交互检查找 data-switch={name}。 */
export function Switch({
  name,
  checked,
  onCheckedChange,
  ariaLabel,
  id,
  disabled,
}: {
  name: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-switch={name}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'size-4 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
