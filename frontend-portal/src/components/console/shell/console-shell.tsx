'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Brand } from '@/components/layout/brand';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { Sheet } from '../dialog';
import { AnnouncementBar } from './announcement-bar';
import { ConsoleSidebar } from './console-sidebar';
import { NotificationsMenu } from './notifications-menu';
import { Avatar } from './user-menu';

/**
 * 控制台外壳：顶部公告条 + 左侧边栏 + 右侧内容区。整屏固定高度，只有内容区滚动。
 * 桌面端侧边栏可收起成图标栏；大屏以下侧边栏换成左侧抽屉，由顶部一条手机栏的菜单按钮打开，换页自动关闭。
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const t = useTranslations('console');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(true);

  // 换页时关掉手机抽屉（渲染时按外部值调整状态，不在副作用里改）
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  return (
    <div data-console-shell className="flex h-dvh flex-col overflow-hidden bg-background">
      {announcementOpen ? <AnnouncementBar onClose={() => setAnnouncementOpen(false)} /> : null}
      <div className="flex min-h-0 flex-1">
        <aside
          data-sidebar
          data-collapsed={collapsed ? 'true' : 'false'}
          className={cn(
            'hidden shrink-0 border-r border-border transition-[width] duration-200 lg:block',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <ConsoleSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 lg:hidden">
            <button
              type="button"
              data-mobile-nav
              aria-label={t('nav.openMenu')}
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Menu aria-hidden className="size-5" />
            </button>
            <Brand />
            <span className="flex-1" />
            <NotificationsMenu side="bottom" />
            <Avatar className="size-7" />
          </div>
          <main
            id="main"
            data-console-main
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          >
            {children}
          </main>
        </div>
      </div>
      <Sheet
        id="console-nav"
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        side="left"
        title={t('nav.label')}
        titleHidden
      >
        <ConsoleSidebar collapsed={false} onNavigate={() => setDrawerOpen(false)} />
      </Sheet>
    </div>
  );
}
