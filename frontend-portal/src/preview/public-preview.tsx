'use client';

import * as React from 'react';

import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { CatalogView } from '../features/catalog/catalog-view';
import { HelpView } from '../features/help/help-view';
import { HomeView } from '../features/home/home-view';
import { PublicFrame } from '../features/public/public-frame';
import type { CatalogData, PublicResult, StatusData } from '../features/public/types';
import { StatusView } from '../features/status/status-view';
import { publicPreviewCatalog, publicPreviewSite, publicPreviewStatus } from './public-fixtures';

/**
 * M1 官网离线预览：与正式页面使用同一套视图组件和集中样例数据。
 * 只做本地状态切换，不导入正式路由、不发请求、不读取环境配置。
 */

/** 预览可切换的数据状态；empty 表示“成功但无数据”，不是接口状态。 */
const DATA_STATUSES = [
  'ready',
  'unavailable',
  'disabled',
  'authentication-required',
  'empty',
] as const;

type DataStatus = (typeof DATA_STATUSES)[number];

const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  ready: '正常数据',
  unavailable: '暂时无法加载',
  disabled: '未开放',
  'authentication-required': '需要登录',
  empty: '空数据',
};

/** 预览可本地切换的四个官网页面。 */
const PREVIEW_PAGES = [
  { id: 'home', path: '/', label: '首页' },
  { id: 'catalog', path: '/catalog', label: '模型' },
  { id: 'status', path: '/status', label: '服务状态' },
  { id: 'help', path: '/help', label: '帮助' },
] as const;

type PreviewPath = (typeof PREVIEW_PAGES)[number]['path'];

function isPreviewPath(path: string): path is PreviewPath {
  return PREVIEW_PAGES.some((page) => page.path === path);
}

/** 把 href 拆成路径与可选 hash（含 #），不解析查询串。 */
function splitHref(href: string): { path: string; hash: string } {
  const index = href.indexOf('#');
  if (index === -1) {
    return { path: href, hash: '' };
  }
  return { path: href.slice(0, index), hash: href.slice(index) };
}

function catalogResult(status: DataStatus): PublicResult<CatalogData> {
  if (status === 'empty') {
    return { kind: 'ready', data: { models: [] } };
  }
  if (status === 'ready') {
    return { kind: 'ready', data: publicPreviewCatalog };
  }
  return { kind: status };
}

function statusResult(status: DataStatus): PublicResult<StatusData> {
  if (status === 'empty') {
    return {
      kind: 'ready',
      data: { ...publicPreviewStatus, availability: null, components: [] },
    };
  }
  if (status === 'ready') {
    return { kind: 'ready', data: publicPreviewStatus };
  }
  return { kind: status };
}

export function PublicPreview() {
  const [route, setRoute] = React.useState<string>('/');
  const [dataStatus, setDataStatus] = React.useState<DataStatus>('ready');

  const { path: activePath } = splitHref(route);

  function changeDataStatus(value: string) {
    if (!(DATA_STATUSES as readonly string[]).includes(value)) {
      return;
    }
    setDataStatus(value as DataStatus);
  }

  function navigate(path: PreviewPath) {
    setRoute(path);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0 });
    }
  }

  /**
   * 捕获站内链接点击：已知四页改为本地切换并回到顶部；
   * 其他站内地址不跳转、也不构造替代页面。外部链接不拦截。
   */
  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest('a');
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) {
      return;
    }
    event.preventDefault();
    const { path, hash } = splitHref(href);
    if (!isPreviewPath(path)) {
      return;
    }
    setRoute(`${path}${hash}`);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0 });
    }
  }

  return (
    <div className="min-h-dvh bg-muted/30 text-foreground" onClickCapture={handleClickCapture}>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex min-h-16 max-w-site flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap md:px-8 xl:px-16">
          <h1 className="text-base font-semibold">官网预览 · 示例数据</h1>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="预览页面" className="flex flex-wrap gap-1">
              {PREVIEW_PAGES.map((page) => (
                <Button
                  key={page.path}
                  data-testid={`public-preview-route-${page.id}`}
                  type="button"
                  size="sm"
                  variant={activePath === page.path ? 'default' : 'ghost'}
                  aria-pressed={activePath === page.path}
                  onClick={() => navigate(page.path)}
                >
                  {page.label}
                </Button>
              ))}
            </nav>
            <Select value={dataStatus} onValueChange={changeDataStatus}>
              <SelectTrigger aria-label="数据状态" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {DATA_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* 与正式路由一致：首页铺满宽度，其余页面正文包一层 py-8。 */}
      <PublicFrame
        site={publicPreviewSite}
        activePath={activePath}
        fullWidth={activePath === '/'}
        onNavigate={(href) => {
          const { path } = splitHref(href);
          if (isPreviewPath(path)) navigate(path);
        }}
      >
        {activePath === '/' ? (
          <HomeView catalog={catalogResult(dataStatus)} site={publicPreviewSite} />
        ) : null}
        {activePath === '/catalog' ? (
          <div className="py-8">
            <CatalogView result={catalogResult(dataStatus)} />
          </div>
        ) : null}
        {activePath === '/status' ? (
          <div className="py-8">
            <StatusView result={statusResult(dataStatus)} />
          </div>
        ) : null}
        {activePath === '/help' ? (
          <div className="py-8">
            <HelpView settings={publicPreviewSite.settings} />
          </div>
        ) : null}
      </PublicFrame>
    </div>
  );
}
