import type { EditionId } from '@/lib/catalog';

import { createRandom, randomToken } from './random';

/**
 * 密钥的状态与打码，真实密钥页在用；API_KEYS 是几条占位密钥，只给首发隐藏的对话页选密钥用。
 */

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
  /** 暂停的日期 */
  pausedAt: string | null;
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
  },
];

/** 打码：sk-Ab3xY9…9XyZ（前 9 位 + 末 4 位） */
export function maskKey(value: string): string {
  return `${value.slice(0, 9)}…${value.slice(-4)}`;
}
