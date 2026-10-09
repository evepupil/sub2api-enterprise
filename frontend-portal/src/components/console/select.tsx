'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  /** 下拉菜单里这一项的样子 */
  label: ReactNode;
  /** 选中后按钮里的样子；不给就用 label（菜单项内容较多时给一个简短的） */
  display?: ReactNode;
}

const TRIGGER =
  'inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-left text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/5 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-border-strong';

const SIZES = { md: 'h-10 text-sm', sm: 'h-8 text-xs' } as const;

/**
 * 下拉选择（单选），筛选栏用。基于下拉菜单：触发按钮显示当前项，菜单宽度不小于按钮。
 * 交互检查：触发按钮 data-select={name}，选项 data-option={value}。
 */
export function Select<T extends string>({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
  align = 'start',
  disabled,
  className,
  menuClassName,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  ariaLabel: string;
  size?: 'md' | 'sm';
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
  /** 菜单的额外类名（如选项较高时放宽最大高度） */
  menuClassName?: string;
}) {
  const current = options.find((option) => option.value === value);
  const handleChange = (next: string) => {
    const option = options.find((o) => o.value === next);
    if (option) onChange(option.value);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          data-select={name}
          aria-label={ariaLabel}
          className={cn(TRIGGER, SIZES[size], className)}
        >
          <span className="min-w-0 truncate">{current?.display ?? current?.label ?? value}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          'max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto',
          menuClassName,
        )}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={handleChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              data-option={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
