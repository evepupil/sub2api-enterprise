/**
 * 注册邮箱后缀白名单，规则与现有 sub2api 注册页一致（frontend/src/utils/registrationEmailPolicy.ts）。
 * 纯函数，单测锁住。
 *
 * 白名单里两种写法：@company.com 只允许这个域名；*.edu.cn 允许 edu.cn 及其所有子域名。
 * 白名单为空表示不限制。
 */

const WILDCARD_PREFIX = '*.';
const INVALID_CHARS = /[^a-z0-9.-]/g;
const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** 提示里最多列出几个后缀，其余写「等 N 个」 */
export const SUFFIX_MESSAGE_LIMIT = 5;

function normalizeDomain(raw: string): string {
  const value = raw.trim().toLowerCase().replace(/^@+/, '');
  if (value.startsWith(WILDCARD_PREFIX)) {
    return `${WILDCARD_PREFIX}${value.slice(WILDCARD_PREFIX.length).replace(INVALID_CHARS, '')}`;
  }
  if (value === '*') return value;
  return value.replace(/[*]/g, '').replace(INVALID_CHARS, '');
}

function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  if (domain.startsWith(WILDCARD_PREFIX)) {
    return DOMAIN_PATTERN.test(domain.slice(WILDCARD_PREFIX.length));
  }
  return !domain.includes('*') && DOMAIN_PATTERN.test(domain);
}

/** 统一成 @company.com 或 *.edu.cn，去掉不合法与重复的项 */
export function normalizeSuffixWhitelist(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const domain = normalizeDomain(item);
    if (!isValidDomain(domain) || seen.has(domain)) continue;
    seen.add(domain);
    result.push(domain.startsWith(WILDCARD_PREFIX) ? domain : `@${domain}`);
  }
  return result;
}

function emailDomain(email: string): string {
  const raw = email.trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at <= 0 || at >= raw.length - 1 || raw.indexOf('@', at + 1) !== -1) return '';
  return raw.slice(at + 1);
}

/** 邮箱是否落在白名单里；白名单为空时一律允许 */
export function isEmailSuffixAllowed(email: string, whitelist: readonly string[]): boolean {
  const allowed = normalizeSuffixWhitelist(whitelist);
  if (allowed.length === 0) return true;
  const domain = emailDomain(email);
  if (!domain) return false;
  return allowed.some((item) => {
    if (item.startsWith('@')) return item === `@${domain}`;
    const base = item.slice(WILDCARD_PREFIX.length);
    return domain === base || domain.endsWith(`.${base}`);
  });
}

/** 提示里列出的可用后缀：最多 5 个，超出的写成 more(剩余个数) */
export function formatSuffixesForMessage(
  whitelist: readonly string[],
  separator: string,
  more: (count: number) => string,
): string {
  const allowed = normalizeSuffixWhitelist(whitelist);
  const visible = allowed.slice(0, SUFFIX_MESSAGE_LIMIT);
  const hidden = allowed.length - visible.length;
  if (hidden > 0) visible.push(more(hidden));
  return visible.join(separator);
}
