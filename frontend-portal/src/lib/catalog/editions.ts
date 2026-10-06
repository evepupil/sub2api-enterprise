import type { EditionId, Localized } from './types';

/**
 * 三种通道（占位数据）：共享通道、专用通道、企业通道。一个通道就是后端的一个分组：
 * API 密钥绑定哪个分组，就按哪个通道的限额和倍率计费，实际扣费 = 官方价 × 分组倍率。
 * 代码里沿用 edition（版本）这个名字和 personal / pro / enterprise 这组 id，页面上统一叫「通道」。
 */
export interface Edition {
  id: EditionId;
  name: Localized;
  /** 一句话定位，用于通道卡与首页通道面板 */
  summary: Localized;
  /** 分组倍率（相对官方价）：0.15 即官方价的 15%；null 表示按合同定制。官网页面只用它算价格，不单独展示 */
  ratio: number | null;
  /** 单个密钥每分钟请求数上限 */
  rpm: number;
  /** 单个账号并发上限 */
  concurrency: number;
  /** 工单首次响应时限，小时 */
  supportHours: number;
  /** 通道页用深色重点卡（每页一张） */
  featured: boolean;
  /** 通道卡按钮：查看定价 / 联系客服 */
  cta: 'pricing' | 'contact';
}

export const EDITION_IDS: readonly EditionId[] = ['personal', 'pro', 'enterprise'];

export const EDITIONS: readonly Edition[] = [
  {
    id: 'personal',
    name: { zh: '共享通道', en: 'Shared' },
    summary: {
      zh: '多人共用资源，按量付费，适合个人开发与日常调用。',
      en: 'Shared capacity, pay as you go, built for individual developers and everyday calls.',
    },
    ratio: 0.15,
    rpm: 60,
    concurrency: 10,
    supportHours: 48,
    featured: false,
    cta: 'pricing',
  },
  {
    id: 'pro',
    name: { zh: '专用通道', en: 'Dedicated' },
    summary: {
      zh: '独立自营号池，高可用、低延迟、不降智。',
      en: 'Our own dedicated pool: high availability, low latency, full-strength models.',
    },
    ratio: 0.3,
    rpm: 600,
    concurrency: 50,
    supportHours: 12,
    featured: true,
    cta: 'pricing',
  },
  {
    id: 'enterprise',
    name: { zh: '企业通道', en: 'Enterprise' },
    summary: {
      zh: '为企业单独开设，适合规模化和合规要求高的企业。',
      en: 'Set up for a single enterprise, built for scale and compliance.',
    },
    ratio: null,
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
