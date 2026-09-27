import * as React from 'react';

import { PublicShell } from '../../components/layout/public-shell';

import type { PublicSiteData } from './types';

/** 页脚固定入口：只放模型、状态、帮助，不添加主体或保障承诺。 */
const FOOTER_NAVIGATION = [
  { href: '/catalog', label: '模型' },
  { href: '/status', label: '服务状态' },
  { href: '/help', label: '帮助' },
] as const;

export interface PublicFrameProps {
  /** 公开站点数据：站名与账号操作入口。 */
  site: PublicSiteData;
  /** 当前路径，用于导航高亮。 */
  activePath: string;
  /** 页面正文。外壳负责唯一的 main。 */
  children?: React.ReactNode;
  /**
   * 首页 hero 需要铺满视口宽度时传 true：
   * main 去掉 max-w-site 与左右边距，由页面自己控制内容宽度。
   */
  fullWidth?: boolean;
  onNavigate?: (href: string) => void;
}

/**
 * 官网页面外壳：站名、导航、账号操作与页脚。
 *
 * - 数据只来自传入的 PublicSiteData，不做任何请求。
 * - 账号操作按 site.accountActions 渲染；为空数组时整块隐藏。
 * - 页脚在唯一的 main 之后，只含站名与三个站内链接。
 */
export function PublicFrame({
  site,
  activePath,
  children,
  fullWidth = false,
  onNavigate,
}: PublicFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicShell
        activePath={activePath}
        siteName={site.settings.siteName}
        actions={site.accountActions}
        fullWidth={fullWidth}
        onNavigate={onNavigate}
        className="min-h-0 flex-1"
      >
        {children}
      </PublicShell>
      <footer data-slot="public-footer" className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-site flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8 xl:px-16">
          <p className="min-w-0 break-words font-medium text-foreground">
            {site.settings.siteName}
          </p>
          <nav aria-label="页脚导航" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {FOOTER_NAVIGATION.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-control outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
