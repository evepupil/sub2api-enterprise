'use client';

import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Brand } from '@/components/layout/brand';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { buttonClass } from '@/components/ui/button-styles';
import { Link, usePathname } from '@/i18n/navigation';
import { NAV_ITEMS, type NavKey } from '@/lib/site';
import { cn } from '@/lib/utils';

/** 页面往下滚过多少像素，顶栏就变成浮动胶囊 */
const SCROLL_THRESHOLD = 80;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const HOVER_SPRING = { type: 'spring', bounce: 0.15, duration: 0.4 } as const;

/** 当前页：地址相同，或在该菜单的子路径下 */
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 顶栏。桌面是一行胶囊（左品牌和菜单，右语言、主题、登录、注册），手机是汉堡菜单。
 * 页面滚过 80px 后背景变成带模糊的浮动胶囊。
 */
export function SiteHeader() {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const { scrollY } = useScroll();

  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<NavKey | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > SCROLL_THRESHOLD);
  });

  // 换页或切换语言（地址变了）时收起手机菜单：地址一变，就在渲染里把展开状态清掉
  const routeKey = `${locale}:${pathname}`;
  const [lastRouteKey, setLastRouteKey] = useState(routeKey);
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey);
    setMenuOpen(false);
  }

  // 按 Esc 收起手机菜单，并把焦点还给汉堡按钮；Esc 已被菜单里的语言下拉用掉时不重复处理
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setMenuOpen(false);
      menuTriggerRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const labels: Record<NavKey, string> = {
    models: t('nav.models'),
    pricing: t('nav.pricing'),
    groups: t('nav.groups'),
    docs: t('nav.docs'),
  };

  return (
    <header data-site-header className="sticky top-0 z-50 w-full px-4 pt-3 md:px-6">
      {/* 桌面 */}
      <nav
        className={cn(
          'mx-auto hidden h-14 max-w-7xl items-center justify-between rounded-full px-6 transition-[background-color,box-shadow,transform] duration-300 lg:flex',
          scrolled
            ? 'translate-y-1.5 bg-background/80 shadow-nav backdrop-blur-md'
            : 'bg-transparent',
        )}
      >
        <div className="flex items-center">
          <Brand />
          <ul className="ml-10 flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
            {NAV_ITEMS.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    data-nav={item.key}
                    aria-current={current ? 'page' : undefined}
                    onMouseEnter={() => setHovered(item.key)}
                    className={cn(
                      'relative rounded-md px-4 py-2 text-sm transition-colors',
                      current
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {!current && hovered === item.key ? (
                      <motion.span
                        layoutId="nav-hover"
                        transition={HOVER_SPRING}
                        className="absolute inset-0 -z-10 rounded-md bg-muted"
                      />
                    ) : null}
                    {labels[item.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link data-nav-login href="/login" className={buttonClass({ variant: 'ghost' })}>
            {t('nav.login')}
          </Link>
          <Link data-nav-register href="/register" className={buttonClass()}>
            {t('nav.register')}
          </Link>
        </div>
      </nav>

      {/* 手机 */}
      <div
        className={cn(
          'mx-auto flex h-14 items-center justify-between rounded-full px-4 transition-[background-color,box-shadow] duration-300 lg:hidden',
          scrolled && 'bg-background/80 shadow-nav backdrop-blur-md',
        )}
      >
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            ref={menuTriggerRef}
            type="button"
            data-mobile-menu-trigger
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            className={buttonClass({
              variant: 'ghost',
              size: 'sm',
              className: 'size-9 px-0 text-muted-foreground hover:text-foreground',
            })}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* 手机菜单面板：和胶囊并列放在顶栏里，位置不受胶囊滚动后的模糊层影响 */}
      <div className="lg:hidden">
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              id="mobile-menu"
              data-mobile-menu
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="absolute inset-x-4 top-[calc(100%+8px)] rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              {NAV_ITEMS.map((item) => {
                const current = isCurrent(pathname, item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'block rounded-md px-3 py-3 text-base text-foreground hover:bg-muted',
                      current && 'bg-muted',
                    )}
                  >
                    {labels[item.key]}
                  </Link>
                );
              })}
              <div className="my-3 border-t border-border" />
              <LanguageSwitcher full />
              <div className="mt-3 grid gap-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className={buttonClass({ variant: 'secondary', block: true })}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className={buttonClass({ block: true })}
                >
                  {t('nav.register')}
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
