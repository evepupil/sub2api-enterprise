'use client';

import { Menu } from 'lucide-react';
import * as React from 'react';

import { isNavigationActive } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';

import type { PublicAction } from '../../features/public/types';
import { Brand } from './brand';
import { ThemeSwitcher } from '../../features/theme/theme-switcher';

/**
 * 官网固定导航：桌面与手机共用这一组链接与匹配规则。
 * 锚点链接（含 #）不参与当前页高亮，避免和真实路由页争同一个 aria-current。
 */
const PUBLIC_NAVIGATION = [
  { href: '/#platform', label: '产品能力' },
  { href: '/catalog', label: '模型价格' },
  { href: '/#pricing', label: '计费方式' },
  { href: '/status', label: '服务状态' },
  { href: '/help', label: '开发文档' },
] as const;

/**
 * M0 预览默认操作入口：未传 actions 时保留旧行为。
 * 正式路由由 PublicFrame 传入配置解析出的 actions；空数组表示隐藏账号操作。
 */
const DEFAULT_ACTIONS: readonly PublicAction[] = [
  { href: '/login', label: '登录' },
  { href: '/console', label: '进入控制台', primary: true },
];

/** 锚点项只做同页定位，不成为“当前页”。 */
function isAnchorHref(href: string): boolean {
  return href.includes('#');
}

function isItemActive(item: { href: string }, activePath: string): boolean {
  return !isAnchorHref(item.href) && isNavigationActive(activePath, item.href);
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
  /** 品牌站名纯文本；未传保留默认映射（旧“模型服务”→ Nexus API）。 */
  siteName?: string;
  /** 导航右侧操作入口；未传保留 M0 预览默认，传空数组则隐藏整块。 */
  actions?: readonly PublicAction[];
  /** 内容区铺满宽度（首页 hero 用），不套 max-w-site 与左右边距。 */
  fullWidth?: boolean;
}

/**
 * 官网外壳：1280px 以上是 top 16px 的浮动窄边框导航条，
 * 初始透明、滚动后变深色模糊卡片；窄屏为 64px 固定顶栏。
 * 品牌在左，五个导航居中，右侧操作由 actions 配置决定。
 * 手机导航收进 44px 触控按钮打开的 Radix Dialog 菜单，链接与匹配规则和桌面一致，
 * 点击链接或 Escape 关闭后焦点归还触发按钮（Radix 原语负责）。
 * 外壳不做数据请求；onNavigate 未传时依赖原生站内导航。
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
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    setMobileOpen(false);
    if (!onNavigate) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  };

  const renderNavLink = (item: { href: string; label: string }, variant: 'bar' | 'menu') => {
    const active = isItemActive(item, activePath);
    return (
      <a
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={handleNavClick(item.href)}
        className={cn(
          'inline-flex items-center rounded-pill text-sm font-medium transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring',
          variant === 'bar' ? 'h-control px-4' : 'h-touch px-3 text-base',
          variant === 'bar'
            ? active
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
            : active
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
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
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring',
          'hover:bg-secondary',
          action.primary === true ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
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
        data-scrolled={scrolled || undefined}
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-colors duration-150 motion-reduce:transition-none',
          'border-b border-border bg-background/90 backdrop-blur',
          // 1280px 以上：top 16px 的浮动窄条，最大宽度与官网内容一致（与 .marketing-shell 对齐）
          'xl:top-[var(--public-header-offset)] xl:mx-auto xl:w-[min(100%,var(--marketing-shell-max))]',
          'xl:rounded-pill xl:border xl:bg-transparent xl:backdrop-blur-none',
          scrolled && 'xl:border-border xl:bg-card/85 xl:shadow-overlay xl:backdrop-blur-xl',
        )}
      >
        <div className="mx-auto flex h-header w-full items-center gap-4 px-4 md:px-8 xl:px-3">
          <Brand
            href="/"
            name={siteName}
            onClick={handleNavClick('/')}
            className="min-w-0 shrink"
          />

          {/* 桌面中部导航：产品能力 / 模型价格 / 计费方式 / 服务状态 / 开发文档。
              1024px 以下改用手机菜单，避免五个中文标签在 768px 挤坏布局。 */}
          <nav aria-label="站内导航" className="hidden flex-1 lg:block">
            <div className="flex items-center justify-center gap-1">
              {PUBLIC_NAVIGATION.map((item) => renderNavLink(item, 'bar'))}
            </div>
          </nav>

          <ThemeSwitcher className="ml-auto lg:ml-0" />

          {/* 桌面右侧操作：actions 为空数组时不渲染 */}
          {actions.length > 0 ? (
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              {actions.map((action) => renderAction(action, 'button'))}
            </div>
          ) : null}

          {/* 手机菜单按钮：44px 触控，打开 Radix Dialog 侧向菜单 */}
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="打开导航菜单" className="lg:hidden">
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="inset-y-0 top-0 right-0 left-auto flex h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 flex-col rounded-none rounded-l-dialog border-l bg-card p-4"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">站内导航</DialogTitle>
              <DialogDescription className="sr-only">
                选择要访问的页面，点击后菜单会关闭。
              </DialogDescription>
              <div className="flex min-h-0 flex-1 flex-col">
                <Brand
                  href="/"
                  name={siteName}
                  onClick={handleNavClick('/')}
                  className="h-touch pr-12"
                />
                <nav
                  aria-label="手机导航"
                  className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
                >
                  {PUBLIC_NAVIGATION.map((item) => renderNavLink(item, 'menu'))}
                </nav>
                {actions.length > 0 ? (
                  <div className="mt-4 flex shrink-0 flex-col gap-1 border-t border-border pt-4">
                    {actions.map((action) => renderAction(action, 'menu'))}
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      {/*
        唯一的 main：顶部留出固定导航的让位间距，避免正文被浮动条遮挡。
        首页 fullWidth 时宽度交给页面自己控制，其余页面沿用 1408px 业务宽度；
        公开内页的 1200px 官网内容宽由 public-pages.css 各页面自己控制，
        这里不改变既有宽度契约，避免与内页实施路冲突。
      */}
      <main
        className={cn(
          'w-full flex-1 pt-[var(--public-header-clearance)]',
          fullWidth ? 'min-w-0' : 'mx-auto max-w-site px-4 md:px-8 xl:px-16',
        )}
      >
        {children}
      </main>
    </div>
  );
}
