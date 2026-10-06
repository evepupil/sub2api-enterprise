import { unstable_cache } from 'next/cache';

import { buildSiteCatalog, type SiteCatalog, type StatusEntry } from '@/lib/catalog/live';
import type { ConsoleChannel } from '@/lib/console/live/models-types';
import { callBackend } from '@/lib/server/sub2api/client';
import { toConsoleChannels } from '@/lib/server/sub2api/model-plaza';
import { toStatusEntries } from '@/lib/server/sub2api/public-status';

/**
 * 官网首页、模型页、价格页的真实模型数据（只在官网服务器上用）。
 *
 * 不带登录读后台两个公开接口：模型广场（分组与单价，后台要打开「模型广场」）、对外服务状态
 * （渠道监测，后台要打开「对外服务状态」）。两份一起缓存 60 秒；用到它的页面每次打开都用缓存里的
 * 数据现做（不在构建时预先生成，构建时通常连不上后台）。
 * 官网展示的分组就是模型广场给未登录访客的那些（勾了「专属」的分组不出现），按分组展示、不做通道对应。
 * 读不到时为空，页面不显示那一块，不拿示例数据充数。
 */

export const SITE_CATALOG_REVALIDATE_SECONDS = 60;

interface SiteCatalogSource {
  channels: ConsoleChannel[] | null;
  status: StatusEntry[] | null;
}

async function loadSource(): Promise<SiteCatalogSource> {
  const [plaza, status] = await Promise.all([
    callBackend<unknown>({ method: 'GET', path: '/model-plaza', forwarded: new Headers() }),
    callBackend<unknown>({ method: 'GET', path: '/status', forwarded: new Headers() }),
  ]);
  return {
    channels: plaza.ok ? toConsoleChannels(plaza.data) : null,
    status: status.ok ? toStatusEntries(status.data) : null,
  };
}

const cachedSource = unstable_cache(loadSource, ['site-catalog-source'], {
  revalidate: SITE_CATALOG_REVALIDATE_SECONDS,
});

/** 官网的全部模型（各分组摊平，带价格与可用率）；后台读不到时为 null */
export async function getSiteCatalog(): Promise<SiteCatalog> {
  try {
    const source = await cachedSource();
    return buildSiteCatalog(source.channels, source.status);
  } catch {
    return null;
  }
}
