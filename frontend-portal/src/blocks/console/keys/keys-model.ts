import { formatDateTime } from '@/lib/console';
import {
  customKeyError,
  EXPIRY_MAX_DAYS,
  nameError,
  parseAmount,
  parseIpList,
  type CustomKeyError,
  type NameError,
} from '@/lib/console/live/keys-rules';
import type {
  KeyCreateInput,
  KeyGroupOption,
  KeyUpdateInput,
  KeyWindows,
  LiveKey,
} from '@/lib/console/live/keys-types';
import { addDays } from '@/lib/console/time';

/**
 * 密钥页的表单与显示规则（纯函数，不碰界面）：创建与编辑共用的草稿、校验、换成请求、
 * 有效期换算、额度比例。规则照 sub2api 的密钥表单；界面文字不在这里，错误只返回代码。
 */

/** 表单草稿：输入框里的原文，提交时才转成数字和名单 */
export interface KeyDraft {
  name: string;
  groupId: number | null;
  /** 自定义密钥（只在创建时可用） */
  useCustomKey: boolean;
  customKey: string;
  ipLimit: boolean;
  ipWhitelist: string;
  ipBlacklist: string;
  /** 额度（美元）；空着或 0 表示不限 */
  quota: string;
  rateLimit: boolean;
  rate5h: string;
  rate1d: string;
  rate7d: string;
  expiry: boolean;
  /** 到期日（北京时间 YYYY-MM-DD，含当天） */
  expiryDate: string;
}

export type KeyFormMode = 'create' | 'edit';

export interface KeyFormErrors {
  name?: NameError;
  group?: 'required';
  customKey?: CustomKeyError;
  ipWhitelist?: 'invalid';
  ipBlacklist?: 'invalid';
  quota?: 'invalid';
  rate5h?: 'invalid';
  rate1d?: 'invalid';
  rate7d?: 'invalid';
  expiryDate?: 'invalid' | 'past' | 'tooFar';
}

/** 表单里各项的顺序：校验出错时焦点落在最前面那一项 */
export const FIELD_ORDER: readonly (keyof KeyFormErrors)[] = [
  'name',
  'group',
  'customKey',
  'ipWhitelist',
  'ipBlacklist',
  'quota',
  'rate5h',
  'rate1d',
  'rate7d',
  'expiryDate',
];

/** 有效期的快捷选项（天），和 sub2api 一样 */
export const EXPIRY_PRESETS = [7, 30, 90] as const;
const DEFAULT_EXPIRY_DAYS = 30;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** 两个日期相差几天（b − a） */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** 北京时间的日期（YYYY-MM-DD） */
export function consoleDate(iso: string): string {
  return formatDateTime(Date.parse(iso)).slice(0, 10);
}

/** 新建密钥的空白草稿：只有一个分组可选时直接选上，否则要用户自己选（和 sub2api 一样） */
export function emptyDraft(today: string, groups: readonly KeyGroupOption[]): KeyDraft {
  return {
    name: '',
    groupId: groups.length === 1 ? (groups[0]?.id ?? null) : null,
    useCustomKey: false,
    customKey: '',
    ipLimit: false,
    ipWhitelist: '',
    ipBlacklist: '',
    quota: '',
    rateLimit: false,
    rate5h: '',
    rate1d: '',
    rate7d: '',
    expiry: false,
    expiryDate: addDays(today, DEFAULT_EXPIRY_DAYS),
  };
}

const amountText = (value: number) => (value > 0 ? String(value) : '');

/** 编辑弹窗的初始草稿：沿用密钥现在的设置 */
export function draftFromKey(key: LiveKey, today: string): KeyDraft {
  const { h5, d1, d7 } = key.rateLimits;
  return {
    name: key.name,
    groupId: key.group?.id ?? null,
    useCustomKey: false,
    customKey: '',
    ipLimit: key.ipWhitelist.length > 0 || key.ipBlacklist.length > 0,
    ipWhitelist: key.ipWhitelist.join('\n'),
    ipBlacklist: key.ipBlacklist.join('\n'),
    quota: amountText(key.quota),
    rateLimit: h5 > 0 || d1 > 0 || d7 > 0,
    rate5h: amountText(h5),
    rate1d: amountText(d1),
    rate7d: amountText(d7),
    expiry: key.expiresAt !== null,
    expiryDate:
      key.expiresAt !== null ? consoleDate(key.expiresAt) : addDays(today, DEFAULT_EXPIRY_DAYS),
  };
}

/**
 * 校验：所有出错的项一起返回。有效期：新建时要晚于今天（至少 1 天），编辑时不早于今天（当天结束才到期），
 * 最长 10 年。关着的开关下面的输入不校验。
 */
export function validateDraft(draft: KeyDraft, mode: KeyFormMode, today: string): KeyFormErrors {
  const errors: KeyFormErrors = {};
  const name = nameError(draft.name);
  if (name) errors.name = name;
  if (draft.groupId === null) errors.group = 'required';
  if (mode === 'create' && draft.useCustomKey) {
    const custom = customKeyError(draft.customKey);
    if (custom) errors.customKey = custom;
  }
  if (draft.ipLimit) {
    if (parseIpList(draft.ipWhitelist) === null) errors.ipWhitelist = 'invalid';
    if (parseIpList(draft.ipBlacklist) === null) errors.ipBlacklist = 'invalid';
  }
  if (parseAmount(draft.quota) === null) errors.quota = 'invalid';
  if (draft.rateLimit) {
    if (parseAmount(draft.rate5h) === null) errors.rate5h = 'invalid';
    if (parseAmount(draft.rate1d) === null) errors.rate1d = 'invalid';
    if (parseAmount(draft.rate7d) === null) errors.rate7d = 'invalid';
  }
  if (draft.expiry) {
    if (!DATE_PATTERN.test(draft.expiryDate) || Number.isNaN(Date.parse(draft.expiryDate))) {
      errors.expiryDate = 'invalid';
    } else {
      const days = daysBetween(today, draft.expiryDate);
      if (days < (mode === 'create' ? 1 : 0)) errors.expiryDate = 'past';
      else if (days > EXPIRY_MAX_DAYS) errors.expiryDate = 'tooFar';
    }
  }
  return errors;
}

export const hasErrors = (errors: KeyFormErrors) => Object.keys(errors).length > 0;

function windowsOf(draft: KeyDraft): KeyWindows {
  if (!draft.rateLimit) return { h5: 0, d1: 0, d7: 0 };
  return {
    h5: parseAmount(draft.rate5h) ?? 0,
    d1: parseAmount(draft.rate1d) ?? 0,
    d7: parseAmount(draft.rate7d) ?? 0,
  };
}

const ipListsOf = (draft: KeyDraft) => ({
  ipWhitelist: draft.ipLimit ? (parseIpList(draft.ipWhitelist) ?? []) : [],
  ipBlacklist: draft.ipLimit ? (parseIpList(draft.ipBlacklist) ?? []) : [],
});

/** 校验通过的草稿 → 创建请求；有效期换成「多少天后到期」 */
export function toCreateInput(draft: KeyDraft, today: string): KeyCreateInput {
  return {
    name: draft.name.trim(),
    groupId: draft.groupId ?? 0,
    customKey: draft.useCustomKey ? draft.customKey.trim() : null,
    ...ipListsOf(draft),
    quota: parseAmount(draft.quota) ?? 0,
    expiresInDays: draft.expiry ? Math.max(1, daysBetween(today, draft.expiryDate)) : null,
    rateLimits: windowsOf(draft),
  };
}

/** 到期日 → 后端的到期时间：北京时间那天结束 */
export const expiresAtOf = (date: string) => `${date}T23:59:59+08:00`;

/**
 * 校验通过的草稿 → 修改请求：名称、分组、IP 名单、额度、限速每次都带（和 sub2api 一样）；
 * 有效期只在改过时才带，免得把原来的到期时刻改成当天结束。
 */
export function toUpdateInput(draft: KeyDraft, key: LiveKey): KeyUpdateInput {
  const input: KeyUpdateInput = {
    name: draft.name.trim(),
    ...ipListsOf(draft),
    quota: parseAmount(draft.quota) ?? 0,
    rateLimits: windowsOf(draft),
  };
  if (draft.groupId !== null) input.groupId = draft.groupId;
  const before = key.expiresAt === null ? null : consoleDate(key.expiresAt);
  const after = draft.expiry ? draft.expiryDate : null;
  if (after !== before) input.expiresAt = after === null ? '' : expiresAtOf(after);
  return input;
}

/** 有效期快捷选项里和这个日期对得上的那一项；都对不上是「自选」 */
export function expiryPresetOf(today: string, date: string): number | 'custom' {
  const days = daysBetween(today, date);
  return EXPIRY_PRESETS.find((preset) => preset === days) ?? 'custom';
}

/** 额度已用比例 0–1；不限额时为 null */
export function quotaRatio(key: Pick<LiveKey, 'quota' | 'quotaUsed'>): number | null {
  if (key.quota <= 0) return null;
  return Math.min(1, key.quotaUsed / key.quota);
}
