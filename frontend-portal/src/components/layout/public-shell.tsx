'use client';

import { Menu } from 'lucide-react';
import * as React from 'react';

import { isNavigationActive } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';

import type { PublicAction } from '../../features/public/types';
import { Brand } from './brand';

/** 官网固定导航：桌面与手机共用这一组链接与匹配规则。 */
const PUBLIC_NAVIGATION = [
  { href: '/', label: '首页' },
  { href: '/catalog', label: '模型' },
  { href: '/status', label: '服务状态' },
  { href: '/help', label: '帮助' },
] as const;

/**
 * M0 预览默认操作入口：未传 actions 时保留旧行为。
 * 正式路由由 PublicFrame 传入配置解析出的 actions；空数组表示隐藏账号操作。
 */
const DEFAULT_ACTIONS: readonly PublicAction[] = [
  { href: '/login', label: '登录' },
  { href: '/console', label: '进入控制台', primary: true },
];

function isItemActive(item: { href: string }, activePath: string): boolean {
  return isNavigationActive(activePath, item.href);
}

export interface PublicShellProps extends React.ComponentProps<'div'> {
  children?: React.ReactNode;
  /** 当前路径，用于唯一 aria-current 判断；传 onNavigate 时预览用本地路径。 */
  activePath?: string;
  /**
   * 导航点击拦截：传入时不做真实站内跳转，由调用方接管（预览本地切换），
   * 并负责更新 activePath。未传时渲染正常链接，站内导航。
   */
  onNavigate?: (href: string) => void;
  /** 品牌站名纯文本；未传保留默认“模型服务”。 */
  siteName?: string;
  /** 导航右侧操作入口；未传保留 M0 预览默认，传空数组则隐藏整块。 */
  actions?: readonly PublicAction[];
  /** 内容区铺满宽度（首页 hero 用），不套 max-w-site 与左右边距。 */
  fullWidth?: boolean;
}

/**
 * 官网外壳：64px 顶栏，品牌左、导航中、操作右。
 * 手机导航收进 44px 触控按钮打开的 Dialog 菜单，链接与匹配规则和桌面一致。
 * 外壳本身不做数据请求；onNavigate 未传时依赖原生站内导航。
 */
export function PublicShell({
  children,
  activePath = '/',
  onNavigate,
  siteName,
  actions = DEFAULT_ACTIONS,
  fullWidth = false,
  className,
  ...props
}: PublicShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleNavClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
    setMobileOpen(false);
  };

  const renderNavLink = (item: { href: string; label: string }) => {
    const active = isItemActive(item, activePath);
    return (
      <a
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={handleNavClick(item.href)}
        className={cn(
          'inline-flex h-touch items-center rounded-control px-3 text-sm font-medium transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
          'hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {item.label}
      </a>
    );
  };

  const renderAction = (action: PublicAction, variant: 'button' | 'menu') => {
    if (variant === 'button') {
      return (
        <Button key={action.href} variant={action.primary === true ? 'default' : 'ghost'} asChild>
          <a href={action.href} onClick={handleNavClick(action.href)}>
            {action.label}
          </a>
        </Button>
      );
    }
    return (
      <a
        key={action.href}
        href={action.href}
        onClick={handleNavClick(action.href)}
        className={cn(
          'flex h-touch items-center rounded-control px-3 text-base font-medium outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
          'hover:bg-muted',
          action.primary === true ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {action.label}
      </a>
    );
  };

  return (
    <div className={cn('flex min-h-dvh flex-col bg-background', className)} {...props}>
      <header
        data-slot="public-header"
        className="sticky top-0 z-40 border-b border-border bg-card"
      >
        <div className="mx-auto flex h-header w-full max-w-site items-center gap-6 px-4 md:px-8 xl:px-16">
          <Brand
            href="/"
            name={siteName}
            onClick={handleNavClick('/')}
            className="min-w-0 shrink"
          />

          {/* 桌面中部导航 */}
          <nav aria-label="站内导航" className="hidden flex-1 md:block">
            <div className="flex items-center justify-center gap-1">
              {PUBLIC_NAVIGATION.map(renderNavLink)}
            </div>
          </nav>

          {/* 桌面右侧操作：actions 为空数组时不渲染 */}
          {actions.length > 0 ? (
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              {actions.map((action) => renderAction(action, 'button'))}
            </div>
          ) : null}

          {/* 手机菜单按钮：44px 触控，打开 Dialog 侧向菜单 */}
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="打开导航菜单"
                className="ml-auto md:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="inset-y-0 right-0 left-auto top-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-y-0 rounded-none rounded-l-dialog border-l"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">站内导航</DialogTitle>
              <DialogDescription className="sr-only">
                选择要访问的页面，点击后菜单会关闭。
              </DialogDescription>
              <nav aria-label="手机导航" className="mt-6 flex flex-col gap-1">
                {PUBLIC_NAVIGATION.map((item) => {
                  const active = isItemActive(item, activePath);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={handleNavClick(item.href)}
                      className={cn(
                        'flex h-touch items-center rounded-control px-3 text-base font-medium transition-colors duration-150 outline-none',
                        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
                        'hover:bg-muted',
                        active ? 'bg-muted text-foreground' : 'text-foreground',
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
                <div className="my-2 border-t border-border" />
                {actions.map((action) => renderAction(action, 'menu'))}
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main
        className={cn(
          'w-full flex-1',
          fullWidth ? 'min-w-0' : 'mx-auto max-w-site px-4 md:px-8 xl:px-16',
        )}
      >
        {children}
      </main>
    </div>
  );
}
