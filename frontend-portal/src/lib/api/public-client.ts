/**
 * 匿名公开数据请求（纯函数，可注入 fetch，不依赖 Next/浏览器）。
 *
 * 契约来源：design/public-site.md 第 2、3 节；返回类型固定于
 * src/features/public/types.ts。
 *
 * 边界：
 * - 只请求固定的三条后端路径。
 * - baseUrl 必须是 http/https、无用户名密码/查询/hash、路径为根的 origin；
 *   缺失或非法时直接返回 unavailable，不调用 fetch。
 * - 不转发 cookie 或 Authorization：credentials omit，不设置自定义请求头。
 * - redirect: error、cache: no-store、5 秒超时（默认）。
 * - 超时同时覆盖 fetch 与响应体解析，即使 fetch stub 不响应 abort 也会返回。
 */

import { parseOrigin } from '@/features/public/settings';
import type { PublicResult } from '@/features/public/types';

/** 固定的公开数据端点。 */
export type PublicEndpoint = 'settings' | 'catalog' | 'status';

/** 端点与后端路径的一一映射，不提供拼接任意路径的能力。 */
const ENDPOINT_PATHS: Record<PublicEndpoint, string> = {
  settings: '/api/v1/settings/public',
  catalog: '/api/v1/model-plaza',
  status: '/api/v1/status',
};

/** 默认请求超时（毫秒）。 */
const DEFAULT_TIMEOUT_MS = 5000;

/** 请求选项。全部可省略，默认使用全局 fetch 与 5 秒超时。 */
export interface PublicRequestOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/** 一次成功请求的中间结果。 */
type FetchOutcome = { kind: 'payload'; payload: unknown } | { kind: 'status'; status: number };

/** 超时标记，用于区分超时与其他失败。 */
class TimeoutError extends Error {
  constructor() {
    super('public request timed out');
    this.name = 'TimeoutError';
  }
}

/**
 * 读取一个公开端点，返回统一的 PublicResult。
 *
 * - 401/403 → authentication-required；404 → disabled；其余非 2xx → unavailable。
 * - 成功要求 JSON 对象且 `code === 0`，并把 `data` 作为 unknown 返回；
 *   业务 message 与其他字段不向外暴露。
 * - 超时、网络错误、非法 JSON、非对象包装或 code 非 0 → unavailable。
 */
export async function fetchPublicData(
  endpoint: PublicEndpoint,
  options: PublicRequestOptions = {},
): Promise<PublicResult<unknown>> {
  const origin = parseOrigin(options.baseUrl);
  if (origin === null) {
    return { kind: 'unavailable' };
  }

  const doFetch = options.fetcher ?? fetch;
  const requestedTimeout = options.timeoutMs;
  const timeoutMs =
    typeof requestedTimeout === 'number' &&
    Number.isFinite(requestedTimeout) &&
    requestedTimeout > 0
      ? requestedTimeout
      : DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);
  });

  const work = (async (): Promise<FetchOutcome> => {
    const response = await doFetch(`${origin}${ENDPOINT_PATHS[endpoint]}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status < 200 || response.status >= 300) {
      return { kind: 'status', status: response.status };
    }
    const payload: unknown = await response.json();
    return { kind: 'payload', payload };
  })();

  try {
    const outcome = await Promise.race([work, timeout]);
    if (outcome.kind === 'status') {
      if (outcome.status === 401 || outcome.status === 403) {
        return { kind: 'authentication-required' };
      }
      if (outcome.status === 404) {
        return { kind: 'disabled' };
      }
      return { kind: 'unavailable' };
    }
    if (typeof outcome.payload !== 'object' || outcome.payload === null) {
      return { kind: 'unavailable' };
    }
    const wrapper = outcome.payload as Record<string, unknown>;
    if (wrapper.code !== 0 || wrapper.data === undefined) {
      return { kind: 'unavailable' };
    }
    return { kind: 'ready', data: wrapper.data };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    controller.abort();
  }
}
