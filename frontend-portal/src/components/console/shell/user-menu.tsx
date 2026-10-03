'use client';

import { ChevronsUpDown, House, LogOut, Settings } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { CURRENT_USER } from '@/lib/console/account';
import { cn } from '@/lib/utils';

/** 头像：深色圆底加名字的首字 */
export function Avatar({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground',
        className,
      )}
    >
      {CURRENT_USER.initials[locale]}
    </span>
  );
}

/**
 * 侧边栏底部的账号菜单：头像、名字与邮箱；菜单里有账户设置、返回官网、退出登录。
 * 收起侧栏时只显示头像。交互检查：触发按钮 data-user-menu，菜单项 data-user-item。
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const name = CURRENT_USER.name[locale];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-user-menu
          aria-label={t('user.menu')}
          className={cn(
            'flex w-full min-w-0 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted',
            collapsed && 'justify-center',
          )}
        >
          <Avatar />
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                <span className="block truncate text-xs text-subtle-foreground">
                  {CURRENT_USER.email}
                </span>
              </span>
              <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-subtle-foreground">{CURRENT_USER.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/console/settings" data-user-item="settings">
            <Settings aria-hidden className="size-4" />
            {t('user.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" data-user-item="site">
            <House aria-hidden className="size-4" />
            {t('user.site')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/login" data-user-item="logout">
            <LogOut aria-hidden className="size-4" />
            {t('user.logout')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
