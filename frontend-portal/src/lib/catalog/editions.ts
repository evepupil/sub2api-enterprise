import type { EditionId, Localized } from './types';

/**
 * 三个服务版本（占位数据）。一个版本就是一个分组：API 密钥绑定哪个分组，
 * 就按哪个版本的渠道、可用率目标和倍率计费，实际扣费 = 官方价 × 分组倍率。
 */
export interface Edition {
  id: EditionId;
  name: Localized;
  /** 一句话定位，用于分组卡与版本说明 */
  summary: Localized;
  /** 分组倍率（相对官方价）：0.15 即官方价的 15%；null 表示按合同定制 */
  ratio: number | null;
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
  /** 分组页用深色重点卡（每页一张） */
  featured: boolean;
  /** 分组卡按钮：注册使用 / 联系销售 */
  cta: 'register' | 'contact';
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
    ratio: 0.15,
    slaTarget: 99.0,
    channel: { zh: '共享渠道池', en: 'Shared pool' },
    rpm: 60,
    concurrency: 10,
    supportHours: 48,
    featured: false,
    cta: 'register',
  },
  {
    id: 'pro',
    name: { zh: '专业版', en: 'Pro' },
    summary: {
      zh: '优选渠道与优先调度，适合团队和生产环境。',
      en: 'Premium channels with priority scheduling, built for teams and production.',
    },
    ratio: 0.3,
    slaTarget: 99.5,
    channel: { zh: '优选渠道', en: 'Premium channels' },
    rpm: 600,
    concurrency: 50,
    supportHours: 12,
    featured: true,
    cta: 'register',
  },
  {
    id: 'enterprise',
    name: { zh: '企业版', en: 'Enterprise' },
    summary: {
      zh: '专属渠道与合同级可用率，适合规模化和合规要求高的企业。',
      en: 'Dedicated channels and contractual availability for enterprises at scale.',
    },
    ratio: null,
    slaTarget: 99.9,
    channel: { zh: '专属渠道', en: 'Dedicated channels' },
    rpm: 3000,
    concurrency: 300,
    supportHours: 1,
    featured: false,
    cta: 'contact',
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
