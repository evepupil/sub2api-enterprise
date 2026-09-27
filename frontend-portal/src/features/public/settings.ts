/**
 * 公开设置解析（纯函数，无网络、无环境依赖）。
 *
 * 契约来源：design/public-site.md 第 2、3 节；类型固定于 ./types.ts。
 * 只拣白名单字段，不读取 home_content、公告或其他受保护内容，
 * 也不执行任何 HTML：所有文本按纯文本返回。
 */

import type { PublicSettings } from './types';

/** 后端未配置站名时的临时默认站名。 */
const DEFAULT_SITE_NAME = '模型服务';

/** 无接口数据时使用的安全默认设置：不伪造客服地址、文档链接或注册开关。 */
export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = Object.freeze({
  siteName: DEFAULT_SITE_NAME,
  contactInfo: null,
  documentationUrl: null,
  registrationEnabled: false,
});

/**
 * 仅接受 http/https、无用户名密码的绝对 URL，返回规范化后的字符串。
 * 其他协议（javascript:、data: 等）、相对地址、含 userinfo 或无法解析的值返回 null。
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.username !== '' || url.password !== '') {
    return null;
  }
  return url.toString();
}

/**
 * 仅接受 http/https、无用户名密码、无查询与 hash、路径为根的 origin，
 * 返回 `protocol//host` 形式；其他输入返回 null。
 */
export function parseOrigin(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.username !== '' || url.password !== '') {
    return null;
  }
  if (url.search !== '' || url.hash !== '') {
    return null;
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return null;
  }
  return `${url.protocol}//${url.host}`;
}

/** 文本字段：去空白后为空返回 null，否则返回去空白后的原文。 */
function parseText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 解析后端 `/api/v1/settings/public` 的业务 `data`。
 *
 * - 顶层必须是普通对象，否则抛错（由请求层转为 unavailable）。
 * - `site_name`：非空字符串才采用，否则回落到默认站名。
 * - `contact_info`：纯文本，去空白后为空为 null；绝不当链接使用。
 * - `doc_url`：仅 http/https 且无 userinfo，否则 null。
 * - `registration_enabled`：严格 `=== true` 才为 true。
 */
export function parsePublicSettings(value: unknown): PublicSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('公开设置数据不是对象');
  }
  const record = value as Record<string, unknown>;

  const siteName = parseText(record.site_name);

  return {
    siteName: siteName ?? DEFAULT_SITE_NAME,
    contactInfo: parseText(record.contact_info),
    documentationUrl: safeHttpUrl(record.doc_url),
    registrationEnabled: record.registration_enabled === true,
  };
}
