'use client';

import { ArrowRight, PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Brand } from '@/components/layout/brand';
import { Link, usePathname } from '@/i18n/navigation';
import { CONSOLE_FEATURES } from '@/lib/console/features';
import { useSession } from '@/lib/session/session-provider';
import { cn } from '@/lib/utils';

import { buttonClass } from '../button';
import { isNavActive, visibleNav } from './nav-items';
import { NotificationsMenu } from './notifications-menu';
import { UserMenu } from './user-menu';

/**
 * 控制台侧边栏：品牌与收起按钮、深色「对话」入口、菜单、底部头像菜单（含语言与主题切换）与通知。
 * 对话入口与通知铃铛按控制台功能开关显示（src/lib/console/features.ts，首发都关着）。
 * collapsed 为真时只显示图标（悬停有原生提示），桌面端可收起；手机端放进左侧抽屉，不收起。
 * 交互检查：菜单项 data-nav={key}，当前页带 aria-current="page"，收起按钮 data-sidebar-toggle。
 */
export function ConsoleSidebar({
  collapsed,
  affiliateEnabled,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  /** 后台有没有开邀请返利；没开或还没读到时不显示「邀请」 */
  affiliateEnabled: boolean | null;
  /** 只有桌面端传，手机抽屉里不显示收起按钮 */
  onToggleCollapse?: () => void;
  /** 点了菜单项之后（手机端用来关抽屉） */
  onNavigate?: () => void;
}) {
  const t = useTranslations('console');
  const pathname = usePathname();
  const { user } = useSession();
  const chatActive = isNavActive(pathname, '/console/chat');

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? null : <Brand />}
        {onToggleCollapse ? (
          <button
            type="button"
            data-sidebar-toggle
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            onClick={onToggleCollapse}
            className="rounded-md p-1.5 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4" />
            )}
          </button>
        ) : null}
      </div>

      {CONSOLE_FEATURES.chat ? (
        <div className={cn('shrink-0', collapsed ? 'px-2' : 'px-3')}>
          <Link
            href="/console/chat"
            data-nav="chat"
            onClick={onNavigate}
            aria-current={chatActive ? 'page' : undefined}
            title={collapsed ? t('nav.chat') : undefined}
            className={buttonClass({
              block: true,
              className: cn('h-10', collapsed ? 'px-0' : 'justify-between px-3'),
            })}
          >
            <span className="flex items-center gap-2">
              <Sparkles aria-hidden />
              <span className={collapsed ? 'sr-only' : undefined}>{t('nav.chat')}</span>
            </span>
            {collapsed ? null : <ArrowRight aria-hidden />}
          </Link>
        </div>
      ) : null}

      <nav
        aria-label={t('nav.label')}
        className={cn('mt-4 min-h-0 flex-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}
      >
        <ul className="space-y-0.5">
          {visibleNav(affiliateEnabled, user?.organization?.isOwner === true).map((item) => {
            const active = isNavActive(pathname, item.href);
            const label = t(`nav.${item.key}`);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  data-nav={item.key}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-md text-sm transition-colors',
                    collapsed ? 'justify-center' : 'px-2.5',
                    active
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <item.icon aria-hidden className="size-4 shrink-0" />
                  <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'flex shrink-0 items-center gap-1 border-t border-border',
          collapsed ? 'flex-col p-2' : 'p-3',
        )}
      >
        <UserMenu placement={collapsed ? 'rail' : 'sidebar'} />
        {CONSOLE_FEATURES.notifications ? <NotificationsMenu /> : null}
      </div>
    </div>
  );
}
