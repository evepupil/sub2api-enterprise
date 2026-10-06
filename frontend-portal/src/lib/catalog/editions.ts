import type { EditionId, Localized } from './types';

/**
 * 三种通道：共享通道、专用通道、企业通道。通道是官网上的说法，用户实际在控制台选后端分组，
 * 分组名里写明属于哪个通道；官网的模型页、价格页直接按分组列价，这里只给通道页与首页通道面板用。
 * 各通道的权益见 groups.ts。代码里沿用 edition（版本）这个名字和 personal / pro / enterprise 这组 id。
 */
export interface Edition {
  id: EditionId;
  name: Localized;
  /** 一句话定位，用于通道卡与首页通道面板 */
  summary: Localized;
  /** 分组倍率（相对官方价）：0.15 即官方价的 15%；null 表示按合同定制。官网页面只用它算价格，不单独展示 */
  ratio: number | null;
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
    featured: false,
    cta: 'pricing',
  },
  {
    id: 'pro',
    name: { zh: '专用通道', en: 'Dedicated' },
    summary: {
      zh: '独立自营号池，适合团队和生产环境。',
      en: 'Our own dedicated pool, built for teams and production.',
    },
    ratio: 0.3,
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
