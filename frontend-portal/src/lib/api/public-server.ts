/**
 * 官网服务端数据入口（server-only）。
 *
 * 契约来源：design/public-site.md 第 2、3 节。
 *
 * 边界：
 * - 只读取 process.env.SUB2API_INTERNAL_URL，不做本机发现、
 *   不读旧 .env、不向客户端暴露内部后端地址或原始错误。
 * - 公开数据不含用户身份，请求层固定 cache: no-store，不产生共享私有缓存。
 * - 用 React cache 做同一请求内的去重（不同请求之间不共享结果）。
 * - 解析适配器（parseCatalog / parseStatus）由其他实现路提供，签名已固定；
 *   解析异常一律转为 unavailable。
 */

import 'server-only';

import { cache } from 'react';

import { parseCatalog } from '@/features/catalog/adapter';
import { DEFAULT_PUBLIC_SETTINGS, parsePublicSettings } from '@/features/public/settings';
import type {
  CatalogData,
  PublicAction,
  PublicResult,
  PublicSettings,
  PublicSiteData,
  StatusData,
} from '@/features/public/types';
import { parseStatus } from '@/features/status/adapter';
import { fetchPublicData, type PublicRequestOptions } from '@/lib/api/public-client';

/** 内部后端 origin 配置（未配置或非法时由请求层返回 unavailable）。 */
function internalRequestOptions(): PublicRequestOptions {
  const baseUrl = process.env.SUB2API_INTERNAL_URL;
  return typeof baseUrl === 'string' ? { baseUrl } : {};
}

/** M2 已接通本站账号与控制台，不依赖原客户界面地址。 */
function accountActions(): PublicAction[] {
  return [
    { href: '/login', label: '登录' },
    { href: '/console', label: '进入控制台', primary: true },
  ];
}

/** 公开站名与账号入口；配置不可用时回落到安全默认设置。 */
export const getPublicSite = cache(async (): Promise<PublicSiteData> => {
  const result = await fetchPublicData('settings', internalRequestOptions());

  let settings: PublicSettings = DEFAULT_PUBLIC_SETTINGS;
  if (result.kind === 'ready') {
    try {
      settings = parsePublicSettings(result.data);
    } catch {
      settings = DEFAULT_PUBLIC_SETTINGS;
    }
  }

  return { settings, accountActions: accountActions() };
});

/** 公开模型目录；请求失败或数据非法时为 unavailable。 */
export const getPublicCatalog = cache(async (): Promise<PublicResult<CatalogData>> => {
  const result = await fetchPublicData('catalog', internalRequestOptions());
  if (result.kind !== 'ready') {
    return result;
  }
  try {
    return { kind: 'ready', data: parseCatalog(result.data) };
  } catch {
    return { kind: 'unavailable' };
  }
});

/** 公开服务状态；请求失败或数据非法时为 unavailable。 */
export const getPublicStatus = cache(async (): Promise<PublicResult<StatusData>> => {
  const result = await fetchPublicData('status', internalRequestOptions());
  if (result.kind !== 'ready') {
    return result;
  }
  try {
    return { kind: 'ready', data: parseStatus(result.data) };
  } catch {
    return { kind: 'unavailable' };
  }
});
