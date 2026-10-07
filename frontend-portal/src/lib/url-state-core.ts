/**
 * 网址查询参数的纯函数部分（不依赖浏览器，可单测，服务端组件也能调用）。
 * 页面上互相独立的区块通过同一个参数（如 ?sort=price-asc）共享状态。
 */

/** 读取单个参数，没有返回 null */
export function readParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

/** 写入单个参数；value 为 null 或空串时删除该参数。返回 '' 或 '?a=b' */
export function writeParam(search: string, key: string, value: string | null): string {
  const params = new URLSearchParams(search);
  if (value === null || value === '') params.delete(key);
  else params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** 取值必须在允许列表里，否则用默认值 */
export function pickAllowed<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** 逗号分隔的多选值，过滤掉不认识的项并去重，保持允许列表的顺序 */
export function readList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const picked = new Set(raw.split(','));
  return allowed.filter((v) => picked.has(v));
}

export function writeList(values: readonly string[]): string | null {
  return values.length ? values.join(',') : null;
}
