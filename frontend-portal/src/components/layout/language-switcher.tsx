'use client';

import { ChevronDown, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { buttonClass } from '@/components/ui/button-styles';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type AppLocale, routing } from '@/i18n/routing';
import { useSwitchLocale } from '@/i18n/use-switch-locale';
import { cn } from '@/lib/utils';

/** 顶栏上的简称。语言名按各自的写法固定显示，不随界面语言翻译。 */
const SHORT_LABEL: Record<AppLocale, string> = { zh: '中文', en: 'EN' };

/**
 * 语言切换下拉。切换时留在当前页，并保留网址里的查询参数（如 ?sort=price-asc）。
 * full 为真时触发按钮显示完整语言名，用在手机菜单里。
 */
export function LanguageSwitcher({
  className,
  full = false,
}: {
  className?: string;
  full?: boolean;
}) {
  const t = useTranslations('common');
  const locale = useLocale();
  const switchLocale = useSwitchLocale();

  const names: Record<AppLocale, string> = { zh: t('language.zh'), en: t('language.en') };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-lang-trigger
          aria-label={t('language.label')}
          className={buttonClass({
            variant: 'ghost',
            size: 'sm',
            className: cn(
              'h-9 gap-1.5 px-3 text-muted-foreground hover:text-foreground',
              className,
            ),
          })}
        >
          <Languages />
          <span>{full ? names[locale] : SHORT_LABEL[locale]}</span>
          {/* 按钮基础样式把内部图标统一成 16px，这里的小箭头要加 ! 才压得过它 */}
          <ChevronDown className="size-3.5!" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={full ? 'start' : 'end'}>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
          {routing.locales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} data-lang={code}>
              {names[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
