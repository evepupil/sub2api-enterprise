import type { EditionId } from '@/lib/catalog';

import { createRandom, randomToken } from './random';

/**
 * API 密钥（占位数据）。每个密钥绑定一个分组（页面上叫通道），按该通道的倍率计费。
 * share / mix 只给用量生成器用：这个密钥占全账号调用量的比例，以及它调用各模型的比例。
 */

/** 用量里出现的模型（都来自模型目录） */
export const USED_MODEL_IDS = [
  'claude-sonnet-5-5',
  'gpt-6-sol',
  'gemini-3.5-flash',
  'deepseek-v4-pro',
  'gpt-image-2',
] as const;

export type UsedModelId = (typeof USED_MODEL_IDS)[number];

export type KeyStatus = 'active' | 'paused' | 'expired';

export const KEY_STATUSES: readonly KeyStatus[] = ['active', 'paused', 'expired'];

export interface ApiKey {
  id: string;
  name: string;
  /** 完整密钥（占位）；界面默认只显示打码后的样子 */
  secret: string;
  group: EditionId;
  status: KeyStatus;
  /** 额度上限（美元），null 表示不限 */
  quotaUsd: number | null;
  /** 到期日（含当天），null 表示永久 */
  expiresAt: string | null;
  createdAt: string;
  /** 暂停的日期，暂停后不再产生用量 */
  pausedAt: string | null;
  share: number;
  mix: Partial<Record<UsedModelId, number>>;
}

const random = createRandom('console-keys');
const secret = () => `sk-${randomToken(random, 40)}`;

export const API_KEYS: readonly ApiKey[] = [
  {
    id: 'key-prod',
    name: '生产环境',
    secret: secret(),
    group: 'pro',
    status: 'active',
    quotaUsd: null,
    expiresAt: null,
    createdAt: '2026-04-12',
    pausedAt: null,
    share: 0.46,
    mix: {
      'claude-sonnet-5-5': 0.35,
      'gpt-6-sol': 0.3,
      'gemini-3.5-flash': 0.25,
      'gpt-image-2': 0.1,
    },
  },
  {
    id: 'key-claude-code',
    name: 'Claude Code',
    secret: secret(),
    group: 'pro',
    status: 'active',
    quotaUsd: 300,
    expiresAt: null,
    createdAt: '2026-05-20',
    pausedAt: null,
    share: 0.3,
    mix: { 'claude-sonnet-5-5': 0.85, 'gpt-6-sol': 0.15 },
  },
  {
    id: 'key-test',
    name: '测试',
    secret: secret(),
    group: 'personal',
    status: 'active',
    quotaUsd: 50,
    expiresAt: '2026-12-31',
    createdAt: '2026-06-03',
    pausedAt: null,
    share: 0.12,
    mix: { 'deepseek-v4-pro': 0.5, 'gemini-3.5-flash': 0.3, 'gpt-image-2': 0.2 },
  },
  {
    id: 'key-labeling',
    name: '数据标注',
    secret: secret(),
    group: 'personal',
    status: 'paused',
    quotaUsd: 100,
    expiresAt: null,
    createdAt: '2026-07-01',
    pausedAt: '2026-09-10',
    share: 0.08,
    mix: { 'gemini-3.5-flash': 0.7, 'deepseek-v4-pro': 0.3 },
  },
  {
    id: 'key-legacy',
    name: '旧版集成',
    secret: secret(),
    group: 'personal',
    status: 'expired',
    quotaUsd: null,
    expiresAt: '2026-08-31',
    createdAt: '2026-04-12',
    pausedAt: null,
    share: 0.04,
    mix: { 'gpt-6-sol': 1 },
  },
];

const KEY_BY_ID = new Map(API_KEYS.map((key) => [key.id, key]));

export function getKey(id: string): ApiKey {
  const key = KEY_BY_ID.get(id);
  if (!key) throw new Error(`unknown key: ${id}`);
  return key;
}

/** 密钥在某天是否还会产生用量：已创建、未暂停、未过期 */
export function keyActiveOn(key: ApiKey, day: string): boolean {
  if (day < key.createdAt) return false;
  if (key.pausedAt !== null && day >= key.pausedAt) return false;
  if (key.expiresAt !== null && day > key.expiresAt) return false;
  return true;
}

/** 打码：sk-Ab3xY9…9XyZ（前 9 位 + 末 4 位） */
export function maskKey(value: string): string {
  return `${value.slice(0, 9)}…${value.slice(-4)}`;
}

/** 按名称或密钥末尾搜索，再按状态过滤；页面上带了用量等字段的行也能直接筛，原样返回 */
export function searchKeys<T extends Pick<ApiKey, 'name' | 'secret' | 'status'>>(
  keys: readonly T[],
  query: string,
  status: KeyStatus | 'all',
): T[] {
  const q = query.trim().toLowerCase();
  return keys.filter(
    (key) =>
      (status === 'all' || key.status === status) &&
      (q === '' || key.name.toLowerCase().includes(q) || key.secret.toLowerCase().endsWith(q)),
  );
}
