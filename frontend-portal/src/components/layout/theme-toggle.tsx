'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import { buttonClass } from '@/components/ui/button-styles';
import { cn } from '@/lib/utils';

/** 明暗主题切换。图标由 CSS 的 dark 类决定显示哪一个，所以服务端和浏览器首次渲染一致。 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={t('theme.toggle')}
      className={buttonClass({
        variant: 'ghost',
        size: 'sm',
        className: cn('size-9 px-0 text-muted-foreground hover:text-foreground', className),
      })}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
