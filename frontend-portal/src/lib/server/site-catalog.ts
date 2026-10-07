import { unstable_cache } from 'next/cache';

import { buildSiteCatalog, type SiteCatalog, type StatusEntry } from '@/lib/catalog/live';
import type { ConsoleChannel } from '@/lib/console/live/models-types';
import { callBackend } from '@/lib/server/sub2api/client';
import type { BackendError, BackendResult } from '@/lib/server/sub2api/envelope';
import { toConsoleChannels } from '@/lib/server/sub2api/model-plaza';
import { toStatusEntries } from '@/lib/server/sub2api/public-status';

/**
 * 官网首页、模型页、价格页的真实模型数据（只在官网服务器上用）。
 *
 * 不带登录读后台两个公开接口：模型广场（分组与单价，后台要打开「模型广场」）、对外服务状态
 * （渠道监测，后台要打开「对外服务状态」）。两份各自缓存 60 秒；用到它的页面每次打开都用缓存里的
 * 数据现做（不在构建时预先生成，构建时通常连不上后台）。
 * 官网展示的分组就是模型广场给未登录访客的那些（勾了「专属」的分组不出现），按分组展示、不做通道对应。
 * 读不到时为空，页面不显示那一块，不拿示例数据充数。
 *
 * 后台临时出错（超时、连不上、5xx、限流）不进缓存，下一位访客会重新读；后台没打开这两个功能（404）
 * 是正常状态，照常缓存。单次最多等 5 秒，后台慢时页面也不会卡太久。
 */

export const SITE_CATALOG_REVALIDATE_SECONDS = 60;

/** 官网页面等后台的上限：比控制台接口短，后台慢时宁可先显示空 */
export const SITE_BACKEND_TIMEOUT_MS = 5_000;

/** 后台临时出错：过一会儿再试可能就好了，这种结果不能缓存 */
export function isTransientFailure(error: BackendError): boolean {
  return error.status >= 500 || error.status === 429 || error.status === 0;
}

/** 后台临时出错时抛出（unstable_cache 不缓存抛出的结果）；其余失败（如功能没打开）当作没有数据 */
export function settle<T>(
  result: BackendResult<unknown>,
  convert: (data: unknown) => T | null,
): T | null {
  if (result.ok) return convert(result.data);
  if (isTransientFailure(result.error)) {
    throw new Error(
      `site catalog backend unavailable: ${result.error.status} ${result.error.reason}`,
    );
  }
  return null;
}

const read = (path: string) =>
  callBackend<unknown>(
    { method: 'GET', path, forwarded: new Headers() },
    { timeoutMs: SITE_BACKEND_TIMEOUT_MS },
  );

const cachedChannels = unstable_cache(
  async (): Promise<ConsoleChannel[] | null> =>
    settle(await read('/model-plaza'), toConsoleChannels),
  ['site-catalog-plaza'],
  { revalidate: SITE_CATALOG_REVALIDATE_SECONDS },
);

const cachedStatus = unstable_cache(
  async (): Promise<StatusEntry[] | null> => settle(await read('/status'), toStatusEntries),
  ['site-catalog-status'],
  { revalidate: SITE_CATALOG_REVALIDATE_SECONDS },
);

/** 官网的全部模型（各分组摊平，带价格与可用率）；后台读不到时为 null，读不到可用率时照常显示价格 */
export async function getSiteCatalog(): Promise<SiteCatalog> {
  const [channels, status] = await Promise.all([
    cachedChannels().catch(() => null),
    cachedStatus().catch(() => null),
  ]);
  return buildSiteCatalog(channels, status);
}
