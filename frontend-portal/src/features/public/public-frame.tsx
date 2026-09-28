'use client';

import * as React from 'react';

import { Brand, resolveBrandName } from '../../components/layout/brand';
import { PublicShell } from '../../components/layout/public-shell';
import { marketingContent } from '../../content/marketing';

import type { PublicSiteData } from './types';

/** 页脚第一列之外的链接分组；只指向真实路由或首页锚点。 */
interface FooterColumn {
  title: string;
  links: readonly { href: string; label: string }[];
}

/** 产品：与桌面导航一致的功能入口。 */
const PRODUCT_LINKS = [
  { href: '/#platform', label: '产品功能' },
  { href: '/catalog', label: '模型价格' },
  { href: '/status', label: '服务状态' },
  { href: '/#stories', label: '客户故事' },
] as const;

/** 资源：文档、FAQ、工具生态与使用场景。 */
const RESOURCE_LINKS = [
  { href: '/help', label: '开发文档' },
  { href: '/#faq', label: '常见问题' },
  { href: '/#integrations', label: '工具生态' },
  { href: '/#scenarios', label: '使用场景' },
] as const;

/** 账户：始终三条站内入口；注册关闭时第二项改为帮助中心。 */
function accountLinks(registrationEnabled: boolean): readonly { href: string; label: string }[] {
  return registrationEnabled
    ? [
        { href: '/login', label: '登录' },
        { href: '/register', label: '创建账户' },
        { href: '/console', label: '进入控制台' },
      ]
    : [
        { href: '/login', label: '登录' },
        { href: '/help', label: '帮助中心' },
        { href: '/console', label: '进入控制台' },
      ];
}

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  { title: '产品', links: PRODUCT_LINKS },
  { title: '资源', links: RESOURCE_LINKS },
];

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
 * 官网页面外壳：悬浮导航、唯一的 main 与四列页脚。
 *
 * - 数据只来自传入的 PublicSiteData，不做任何请求。
 * - 账号操作按 site.accountActions 渲染；为空数组时整块隐藏。
 * - 页脚四列：品牌与定位、产品 4 链接、资源 4 链接、账户 3 链接。
 * - 底部固定 Nexus API 与 2026、USD / 按量计费，不添加外部联系方式。
 */
export function PublicFrame({
  site,
  activePath,
  children,
  fullWidth = false,
  onNavigate,
}: PublicFrameProps) {
  const brandName = resolveBrandName(site.settings.siteName);
  const columns: readonly FooterColumn[] = [
    ...FOOTER_COLUMNS,
    { title: '账户', links: accountLinks(site.settings.registrationEnabled) },
  ];

  const handleLinkClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  };

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
        <div className="mx-auto w-full max-w-site px-4 py-12 md:px-8 xl:px-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="min-w-0">
              <Brand name={site.settings.siteName} />
              <p className="mt-3 max-w-[36ch] text-sm text-muted-foreground">
                {marketingContent.brand.tagline}
              </p>
            </div>
            {columns.map((column) => (
              <nav
                key={column.title}
                aria-label={`页脚${column.title}`}
                className="flex min-w-0 flex-col gap-3"
              >
                <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
                <ul className="flex flex-col gap-2">
                  {column.links.map((item) => (
                    <li key={`${column.title}:${item.label}`}>
                      <a
                        href={item.href}
                        onClick={handleLinkClick(item.href)}
                        className="rounded-control text-sm break-words text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-ring"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words">© 2026 {brandName} · 保留所有权利</p>
            <p className="min-w-0 break-words">USD / 按量计费</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
