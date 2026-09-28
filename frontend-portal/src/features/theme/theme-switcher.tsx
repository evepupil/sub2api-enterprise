'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { cn } from '../../lib/utils';
import { useTheme } from './use-theme';

const OPTIONS = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const;

export function ThemeSwitcher({
  compact = true,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[1];
  const Icon = current.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'default'}
          className={cn('shrink-0', !compact && 'w-full justify-start', className)}
          aria-label={`切换主题，当前：${current.label}`}
          title={`主题：${current.label}`}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {!compact ? (
            <>
              <span className="flex-1 text-left">外观</span>
              <span className="text-xs text-muted-foreground">{current.label}</span>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1" aria-label="选择主题">
        <div role="group" aria-label="主题外观" className="flex flex-col gap-1">
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <Button
              key={value}
              variant="ghost"
              className={cn('w-full justify-start gap-3', preference === value && 'bg-muted')}
              aria-pressed={preference === value}
              onClick={() => {
                setPreference(value);
                setOpen(false);
              }}
            >
              <OptionIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {preference === value ? <Check className="size-4" aria-hidden="true" /> : null}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
