/**
 * 创建、修改密钥的输入规则，浏览器的表单和官网服务器共用（服务器再校验一遍，不信浏览器）。
 * 规则照后端：名称不能空、最长 100 字节；自定义密钥 16–128 位，只能用字母、数字、下划线、连字符；
 * IP 名单一行一个 IP 或网段；金额不能是负数，0 表示不限。纯函数，单测锁住。
 */

/** 后端名称字段最长 100 字节（中文一个字占 3 字节） */
export const NAME_MAX_BYTES = 100;
export const CUSTOM_KEY_MIN = 16;
export const CUSTOM_KEY_MAX = 128;
/** 额度、限速金额的上限，防止手滑多打几个零 */
export const AMOUNT_MAX = 1_000_000;
/** 有效期最长 10 年 */
export const EXPIRY_MAX_DAYS = 3650;
/** 白名单、黑名单各最多多少条 */
export const IP_LIST_MAX = 100;

const CUSTOM_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
/** IPv4、IPv6，可带 /前缀长度；格式细节交给后端判断，这里只拦明显不对的 */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
/** IPv6 一定带冒号（只有十六进制字母的词，如 cafe，不算） */
const IPV6_PATTERN = /^[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*(\/\d{1,3})?$/;

export type NameError = 'required' | 'tooLong';
export type CustomKeyError = 'required' | 'tooShort' | 'tooLong' | 'invalidChars';

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

export function nameError(name: string): NameError | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'required';
  return utf8Length(trimmed) > NAME_MAX_BYTES ? 'tooLong' : null;
}

export function customKeyError(key: string): CustomKeyError | null {
  const trimmed = key.trim();
  if (trimmed === '') return 'required';
  if (trimmed.length < CUSTOM_KEY_MIN) return 'tooShort';
  if (trimmed.length > CUSTOM_KEY_MAX) return 'tooLong';
  return CUSTOM_KEY_PATTERN.test(trimmed) ? null : 'invalidChars';
}

/** 金额是否可用：不是负数、不超过上限的有限数 */
export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= AMOUNT_MAX;
}

/** 输入框里的金额：空着算 0（不限）；不是数字、负数或太大时返回 null */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const value = Number(trimmed);
  return isValidAmount(value) ? value : null;
}

/** 一个名单条目是否像 IP 或网段 */
export function isIpEntry(value: string): boolean {
  return IPV4_PATTERN.test(value) || IPV6_PATTERN.test(value);
}

/** 多行文本 → IP 名单：一行一个，去掉空行；有一行不像 IP、或超过条数时返回 null */
export function parseIpList(text: string): string[] | null {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (entries.length > IP_LIST_MAX || !entries.every(isIpEntry)) return null;
  return entries;
}

/** 有效期天数是否可用 */
export function isValidExpiryDays(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= EXPIRY_MAX_DAYS
  );
}
