'use client';

import {
  ChartColumn,
  CircleHelp,
  House,
  KeyRound,
  Menu,
  Settings,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { ThemeSwitcher } from '../../features/theme/theme-switcher';

import { getConsoleNavigation, isNavigationActive } from '../../lib/navigation';
import type { Audience, NavigationItem } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';

import { Brand } from './brand';

/** 导航图标约定集合的唯一映射，项来自 lib/navigation，不另写重复规则。 */
const NAVIGATION_ICONS: Record<NavigationItem['icon'], LucideIcon> = {
  overview: House,
  key: KeyRound,
  usage: ChartColumn,
  wallet: Wallet,
  team: Users,
  settings: Settings,
  help: CircleHelp,
};

/** 账户标识按门户身份固定文案，不展示昵称、邮箱或组织名。 */
const ACCOUNT_LABELS: Record<Audience, string> = {
  personal: '个人账户',
  owner: '组织管理员',
  member: '组织成员',
};

/** 固定在侧栏底部的入口：账号设置与帮助从主导航分离。 */
const FOOTER_ICONS: ReadonlySet<NavigationItem['icon']> = new Set(['settings', 'help']);

/** 底部区顺序：帮助在前，账号设置固定为最下方一行。 */
const FOOTER_ORDER: readonly NavigationItem['icon'][] = ['help', 'settings'];

export interface ConsoleShellProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  children?: React.ReactNode;
  /** 门户身份，只决定显示哪些导航入口与账户文案，不承担鉴权。 */
  audience: Audience;
  /** 当前路径，用于唯一 aria-current 判断与路径行当前页文案。 */
  activePath: string;
  /** 传入时拦截导航点击（预览本地切换）；未传时为正常链接。 */
  onNavigate?: (href: string) => void;
  /** 账户操作（如退出登录）；未传时不渲染。 */
  accountActions?: React.ReactNode;
  /** 需要隐藏的导航路径；只影响展示，不改动 lib/navigation 的函数契约。 */
  hiddenPaths?: readonly string[];
}

/** 账户标识行：用户图标 + 按身份固定的文案。 */
function AccountIdentity({ audience, className }: { audience: Audience; className?: string }) {
  return (
    <span
      className={cn('flex min-w-0 items-center gap-3 text-sm text-muted-foreground', className)}
    >
      <UserRound className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{ACCOUNT_LABELS[audience]}</span>
    </span>
  );
}

/**
 * 控制台外壳：桌面 216px 侧栏固定在视口内，业务导航滚动、
 * 帮助与账号设置在底部固定区；手机收进 44px 按钮打开的 Dialog。
 * 导航项与可见性完全来自 lib/navigation；最长匹配项作为唯一当前项，
 * 父子同时命中时在 resolveCurrent 中裁决。
 */
export function ConsoleShell({
  children,
  audience,
  activePath,
  onNavigate,
  accountActions,
  hiddenPaths,
  className,
  ...props
}: ConsoleShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const items = React.useMemo(
    () =>
      getConsoleNavigation(audience).filter(
        (item) => hiddenPaths === undefined || !hiddenPaths.includes(item.href),
      ),
    [audience, hiddenPaths],
  );

  /** 主导航只含业务入口；帮助与账号设置进入底部固定区。 */
  const mainItems = React.useMemo(
    () => items.filter((item) => !FOOTER_ICONS.has(item.icon)),
    [items],
  );
  const footerItems = React.useMemo(
    () =>
      FOOTER_ORDER.map((icon) => items.find((item) => item.icon === icon)).filter(
        (item): item is NavigationItem => item !== undefined,
      ),
    [items],
  );

  /**
   * 当前项：在命中项里取最长 href，保证 `/console/team/usage` 命中组织用量
   * 而不是概览或组织成员；没有命中时回退到概览项（列表首项）。
   * 判断范围是全体 items，底部入口同样参与，不破坏 active 高亮。
   */
  const resolveCurrent = (list: readonly NavigationItem[]): NavigationItem => {
    const matches = list.filter((item) => isNavigationActive(activePath, item.href));
    if (matches.length === 0) {
      return list[0]!;
    }
    return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best));
  };

  const current = items.length > 0 ? resolveCurrent(items) : null;

  const handleNavClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    // 无论是否传 onNavigate，正常导航都要收起手机抽屉。
    setMobileOpen(false);
    if (!onNavigate) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  };

  const renderNavItem = (item: NavigationItem) => {
    const Icon = NAVIGATION_ICONS[item.icon];
    const active = current !== null && item.href === current.href;
    return (
      <a
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={handleNavClick(item.href)}
        className={cn(
          'flex h-touch items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-ring',
          'hover:bg-secondary hover:text-foreground',
          active ? 'bg-secondary text-primary' : 'text-muted-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </a>
    );
  };

  const renderNavGroup = (list: readonly NavigationItem[], label: string) => (
    <nav aria-label={label} className="flex flex-col gap-1">
      {list.map((item) => renderNavItem(item))}
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
            className="inset-y-0 top-0 right-0 left-auto flex h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 flex-col rounded-none rounded-l-dialog border-l p-4"
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">控制台导航</DialogTitle>
            <DialogDescription className="sr-only">
              选择要访问的页面，点击后菜单会关闭。
            </DialogDescription>
            <div className="flex min-h-0 flex-1 flex-col">
              <AccountIdentity audience={audience} className="h-touch px-3" />
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto">
                {renderNavGroup(mainItems, '控制台导航')}
              </div>
              <div className="mt-4 flex shrink-0 flex-col gap-1 border-t border-border pt-4">
                {accountActions !== undefined ? (
                  <div className="mb-2 flex flex-col gap-2">{accountActions}</div>
                ) : null}
                {renderNavGroup(footerItems, '控制台底部导航')}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Brand className="min-w-0" />
        <AccountIdentity audience={audience} className="ml-auto hidden text-xs sm:flex" />
        <ThemeSwitcher className="ml-auto sm:ml-0" />
      </header>

      {/* 桌面侧栏：216px 深色卡片右边框，固定在视口内 */}
      <aside
        data-slot="console-sidebar"
        className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-r border-border bg-card md:flex"
      >
        <div className="flex h-header shrink-0 items-center px-4">
          <Brand href="/console" onClick={handleNavClick('/console')} />
        </div>
        <AccountIdentity audience={audience} className="h-touch shrink-0 px-7" />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-4">
          {renderNavGroup(mainItems, '控制台导航')}
        </div>
        <div className="shrink-0 border-t border-border p-4">
          <div className="mb-2">
            <ThemeSwitcher compact={false} />
          </div>
          {accountActions !== undefined ? (
            <div className="mb-2 flex flex-col gap-2">{accountActions}</div>
          ) : null}
          {renderNavGroup(footerItems, '控制台底部导航')}
        </div>
      </aside>

      {/* 主内容区：桌面水平 24px、顶部 16px，手机水平 16px */}
      <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-4">
        <div className="mx-auto w-full max-w-site">
          {/* 路径行：控制台 / 当前页，位于内容之前，与内容留 8px */}
          <nav
            aria-label="面包屑"
            className="mb-2 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
          >
            <a
              href="/console"
              onClick={handleNavClick('/console')}
              className="rounded-control outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
            >
              控制台
            </a>
            {current !== null ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="min-w-0 truncate">{current.label}</span>
              </>
            ) : null}
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
