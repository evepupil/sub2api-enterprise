/**
 * 控制台的登录拦截与登录后回跳的地址计算。纯函数，单测锁住；服务端拦截（src/proxy.ts）和登录页共用。
 *
 * 回跳地址统一不带语言前缀（/console/keys 而不是 /en/console/keys）：登录页用站内导航跳转时，
 * 会按当前语言自动补前缀，带着前缀再补就成了 /en/en/...。
 */

/** 登录后默认去的页面 */
export const DEFAULT_AFTER_LOGIN = '/console/usage';

const EN_PREFIX = '/en';

/** 是否英文地址（/en 或 /en/...） */
function isEnglish(pathname: string): boolean {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`);
}

/** 去掉语言前缀 */
function withoutLocale(pathname: string): string {
  if (!isEnglish(pathname)) return pathname;
  const rest = pathname.slice(EN_PREFIX.length);
  return rest === '' ? '/' : rest;
}

/** 没登录访问控制台时，跳去的登录页地址（相对地址，带上回跳参数） */
export function loginRedirectFor(pathname: string, search: string): string {
  const loginPath = isEnglish(pathname) ? `${EN_PREFIX}/login` : '/login';
  const next = `${withoutLocale(pathname)}${search}`;
  return `${loginPath}?next=${encodeURIComponent(next)}`;
}

/**
 * 登录成功后去哪：只接受控制台里的站内地址，其余（外站地址、//开头、反斜杠、空值）一律回默认页，
 * 防止登录页被拿来把人带到别的网站。
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_AFTER_LOGIN;
  }
  const path = withoutLocale(value);
  if (path === '/console' || path.startsWith('/console/') || path.startsWith('/console?')) {
    return path;
  }
  return DEFAULT_AFTER_LOGIN;
}
