'use client';

import { Bell } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { buttonClass } from '@/components/ui/button-styles';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { NOTIFICATIONS } from '@/lib/console/account';
import { formatDateTimeShort } from '@/lib/console/time';
import { cn } from '@/lib/utils';

/** 通知铃铛：有未读时右上角一个红点；菜单列出最近的通知，点了跳到相关页面。 */
export function NotificationsMenu({ side = 'top' }: { side?: 'top' | 'bottom' }) {
  const t = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const unread = NOTIFICATIONS.some((n) => n.unread);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-notifications
          aria-label={t('notifications.label')}
          className={buttonClass({
            variant: 'ghost',
            size: 'sm',
            className: 'relative size-9 px-0 text-muted-foreground hover:text-foreground',
          })}
        >
          <Bell aria-hidden className="size-4" />
          {unread ? (
            <span
              aria-hidden
              className="absolute right-2 top-2 size-1.5 rounded-full bg-danger-graphic"
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-72">
        <DropdownMenuLabel>{t('notifications.title')}</DropdownMenuLabel>
        {NOTIFICATIONS.map((item) => (
          <DropdownMenuItem key={item.id} asChild>
            <Link href={item.href} data-notification={item.id} className="items-start">
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                  item.unread ? 'bg-danger-graphic' : 'bg-transparent',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">{item.title[locale]}</span>
                <span className="block text-xs tabular-nums text-subtle-foreground">
                  {formatDateTimeShort(item.ts)}
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
