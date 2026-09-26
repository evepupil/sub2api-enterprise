'use client';

import { ChartColumn, CircleHelp, KeyRound, Menu, Settings, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { getConsoleNavigation, isNavigationActive } from '../../lib/navigation';
import type { NavigationItem } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';

import { Brand } from './brand';

/** 导航图标约定集合的唯一映射，项来自 lib/navigation，不另写重复规则。 */
const NAVIGATION_ICONS: Record<NavigationItem['icon'], LucideIcon> = {
  overview: ChartColumn,
  key: KeyRound,
  usage: ChartColumn,
  wallet: Wallet,
  team: Users,
  settings: Settings,
  help: CircleHelp,
};

export interface ConsoleShellProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  children?: React.ReactNode;
  /** 门户身份，只决定显示哪些导航入口，不承担鉴权。 */
  audience: 'personal' | 'owner' | 'member';
  /** 当前路径，用于唯一 aria-current 判断。 */
  activePath: string;
  /** 顶部身份标识文案，如「个人账户」。 */
  accountLabel: string;
  /** 传入时拦截导航点击（预览本地切换）；未传时为正常链接。 */
  onNavigate?: (href: string) => void;
}

/**
 * 控制台外壳：桌面 216px 白底右侧边框侧栏，手机收进 44px 按钮打开的 Dialog。
 * 导航项与可见性完全来自 lib/navigation；最长匹配项作为唯一当前项，
 * 父子同时命中时在 resolveCurrent 中裁决。
 */
export function ConsoleShell({
  children,
  audience,
  activePath,
  accountLabel,
  onNavigate,
  className,
  ...props
}: ConsoleShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const items = React.useMemo(() => getConsoleNavigation(audience), [audience]);

  /**
   * 当前项：在命中项里取最长 href，保证 `/console/team/usage` 命中组织用量
   * 而不是概览或组织成员；没有命中时回退到概览项（列表首项）。
   */
  const resolveCurrent = (list: readonly NavigationItem[]): NavigationItem => {
    const matches = list.filter((item) => isNavigationActive(activePath, item.href));
    if (matches.length === 0) {
      return list[0]!;
    }
    return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best));
  };

  const handleNavClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
    setMobileOpen(false);
  };

  const renderNavItem = (item: NavigationItem, current: NavigationItem) => {
    const Icon = NAVIGATION_ICONS[item.icon];
    const active = item.href === current.href;
    return (
      <a
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={handleNavClick(item.href)}
        className={cn(
          'flex h-touch items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
          'hover:bg-muted hover:text-foreground',
          active ? 'bg-muted text-foreground' : 'text-muted-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </a>
    );
  };

  const current = resolveCurrent(items);

  const sidebarBody = (
    <nav aria-label="控制台导航" className="flex flex-col gap-1">
      {items.map((item) => renderNavItem(item, current))}
    </nav>
  );

  return (
    <div className={cn('flex min-h-dvh flex-col bg-background md:flex-row', className)} {...props}>
      {/* 手机顶栏：44px 菜单按钮 + 品牌 + 身份标识 */}
      <header
        data-slot="console-mobile-header"
        className="sticky top-0 z-40 flex h-header shrink-0 items-center gap-2 border-b border-border bg-card px-4 md:hidden"
      >
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="打开导航菜单">
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent
            className="inset-y-0 right-0 left-auto top-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-y-0 rounded-none rounded-l-dialog border-l"
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">控制台导航</DialogTitle>
            <DialogDescription className="sr-only">
              选择要访问的页面，点击后菜单会关闭。
            </DialogDescription>
            <div className="mt-6">{sidebarBody}</div>
          </DialogContent>
        </Dialog>
        <Brand className="min-w-0" />
        <span
          className="ml-auto min-w-0 truncate rounded-control bg-secondary px-2 py-1 text-xs text-secondary-foreground"
          title={accountLabel}
        >
          {accountLabel}
        </span>
      </header>

      {/* 桌面侧栏：216px 白底右边框 */}
      <aside
        data-slot="console-sidebar"
        className="hidden w-sidebar shrink-0 flex-col border-r border-border bg-card md:flex"
      >
        <div className="flex h-header shrink-0 items-center border-b border-border px-4">
          <Brand href="/console" onClick={handleNavClick('/console')} />
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            <span className="px-3 text-xs text-muted-foreground">{accountLabel}</span>
            {sidebarBody}
          </div>
        </div>
      </aside>

      {/* 主内容区：桌面留白 32px，手机 16px */}
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-site">{children}</div>
      </main>
    </div>
  );
}
