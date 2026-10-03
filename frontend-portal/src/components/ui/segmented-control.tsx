'use client';

import { motion } from 'motion/react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 标签后面的数量，如筛选项的命中个数 */
  count?: number;
}

type Size = 'sm' | 'md';
type Tone = 'default' | 'inverse';

const ROOT: Record<Tone, string> = {
  default: 'relative inline-flex items-center rounded-lg bg-muted p-1',
  inverse: 'relative inline-flex items-center rounded-lg bg-white/10 p-1',
};

const ITEM_BASE = 'relative z-0 inline-flex items-center rounded-md font-medium transition-colors';

const ITEM_SIZE: Record<Size, string> = {
  md: 'h-9 px-4 text-sm',
  sm: 'h-7 px-3 text-xs',
};

const ITEM_IDLE: Record<Tone, string> = {
  default: 'text-muted-foreground hover:text-foreground',
  inverse: 'text-navy-muted hover:text-white',
};

const ITEM_ACTIVE: Record<Tone, string> = {
  default: 'text-primary-foreground',
  inverse: 'text-neutral-900',
};

const THUMB: Record<Tone, string> = {
  default: 'absolute inset-0 -z-10 rounded-md bg-primary shadow-button',
  inverse: 'absolute inset-0 -z-10 rounded-md bg-white',
};

const SPRING = { type: 'spring', bounce: 0.15, duration: 0.4 } as const;

/**
 * 分段控件（单选）：选中块用共享布局动画在选项之间滑动。
 * 同一页里 name 相同的控件共用同一个滑块，所以每种控件用自己固定的 name。
 */
export function SegmentedControl<T extends string>({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
  tone = 'default',
  className,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  ariaLabel: string;
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  // 当前值不在选项里时，让第一项能被键盘 Tab 到
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  /** 方向键：切到相邻选项（首尾相接）并把焦点跟过去 */
  const move = (from: number, step: 1 | -1) => {
    const total = options.length;
    if (total === 0) return;
    const nextIndex = (from + step + total) % total;
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    itemRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-segmented={name}
      className={cn(ROOT[tone], className)}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            data-segment={option.value}
            data-active={selected ? 'true' : 'false'}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              ITEM_BASE,
              ITEM_SIZE[size],
              selected ? ITEM_ACTIVE[tone] : ITEM_IDLE[tone],
            )}
          >
            {selected ? (
              <motion.span layoutId={`seg-${name}`} className={THUMB[tone]} transition={SPRING} />
            ) : null}
            {option.label}
            {option.count !== undefined ? (
              <span className="ml-1.5 tabular-nums opacity-60">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
