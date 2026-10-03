import type { EditionId, Localized } from './types';

/**
 * 三个服务版本（占位数据）。本质区别是可用率承诺、渠道质量和价格：
 * 价格差异由各版本的分组倍率体现（groups.ts），这里只放版本本身的服务指标。
 */
export interface Edition {
  id: EditionId;
  name: Localized;
  /** 一句话定位，用于版本切换下方的说明条与卡片 */
  summary: Localized;
  /** 可用率目标，百分数 */
  slaTarget: number;
  /** 渠道类型 */
  channel: Localized;
  /** 单个密钥每分钟请求数上限 */
  rpm: number;
  /** 单个账号并发上限 */
  concurrency: number;
  /** 工单首次响应时限，小时 */
  supportHours: number;
}

export const EDITION_IDS: readonly EditionId[] = ['personal', 'pro', 'enterprise'];

export const EDITIONS: readonly Edition[] = [
  {
    id: 'personal',
    name: { zh: '个人版', en: 'Personal' },
    summary: {
      zh: '共享渠道，按量付费，适合个人开发与日常调用。',
      en: 'Shared channels, pay as you go, built for individual developers and everyday calls.',
    },
    slaTarget: 99.0,
    channel: { zh: '共享渠道池', en: 'Shared pool' },
    rpm: 60,
    concurrency: 10,
    supportHours: 48,
  },
  {
    id: 'pro',
    name: { zh: '专业版', en: 'Pro' },
    summary: {
      zh: '优选渠道与优先调度，适合团队和生产环境。',
      en: 'Premium channels with priority scheduling, built for teams and production.',
    },
    slaTarget: 99.5,
    channel: { zh: '优选渠道', en: 'Premium channels' },
    rpm: 600,
    concurrency: 50,
    supportHours: 12,
  },
  {
    id: 'enterprise',
    name: { zh: '企业版', en: 'Enterprise' },
    summary: {
      zh: '专属渠道与合同级可用率，适合规模化和合规要求高的企业。',
      en: 'Dedicated channels and contractual availability for enterprises at scale.',
    },
    slaTarget: 99.9,
    channel: { zh: '专属渠道', en: 'Dedicated channels' },
    rpm: 3000,
    concurrency: 300,
    supportHours: 1,
  },
];

const BY_ID = new Map(EDITIONS.map((e) => [e.id, e]));

export function getEdition(id: EditionId): Edition {
  const edition = BY_ID.get(id);
  if (!edition) throw new Error(`unknown edition: ${id}`);
  return edition;
}

export function isEditionId(value: string): value is EditionId {
  return (EDITION_IDS as readonly string[]).includes(value);
}
