import type { EditionId, Localized } from '@/lib/catalog';

import { dayStart, HOUR_MS } from './time';

/** 当前登录用户（占位） */
export const CURRENT_USER: {
  name: Localized;
  email: string;
  /** 头像里显示的字 */
  initials: Localized;
  /** 新建密钥时默认选中的分组 */
  defaultGroup: EditionId;
} = {
  name: { zh: '林舟', en: 'Lin Zhou' },
  email: 'linzhou@example.com',
  initials: { zh: '林', en: 'LZ' },
  defaultGroup: 'pro',
};

/** 顶部公告条（占位），轮流显示 */
export interface Announcement {
  id: string;
  text: Localized;
  /** 站内链接（控制台内的路径） */
  href: string | null;
}

export const ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: 'a-gpt6',
    text: {
      zh: 'GPT-6 已上线：旗舰 Astra 与均衡款 Sol，105 万上下文。',
      en: 'GPT-6 is live: flagship Astra and balanced Sol with a 1.05M context.',
    },
    href: '/console/models',
  },
  {
    id: 'a-image',
    text: {
      zh: 'Nano Banana 2 生图接口已开放，支持图生图与局部编辑。',
      en: 'Nano Banana 2 image generation is open, with image-to-image and inpainting.',
    },
    href: '/console/models',
  },
  {
    id: 'a-invoice',
    text: {
      zh: '9 月账单已出，专用分组与企业分组可通过工单申请发票。',
      en: 'September bills are ready. Dedicated and Enterprise customers can request invoices via a ticket.',
    },
    href: '/console/tickets',
  },
];

/** 通知（占位） */
export interface ConsoleNotification {
  id: string;
  ts: number;
  title: Localized;
  href: string;
  unread: boolean;
}

export const NOTIFICATIONS: readonly ConsoleNotification[] = [
  {
    id: 'n-1',
    ts: dayStart('2026-10-03') + 10 * HOUR_MS + 5 * 60_000,
    title: {
      zh: '工单 T-1024 有新回复',
      en: 'New reply on ticket T-1024',
    },
    href: '/console/tickets',
    unread: true,
  },
  {
    id: 'n-2',
    ts: dayStart('2026-10-01') + 9 * HOUR_MS,
    title: {
      zh: '成员赵可本月配额已用完',
      en: 'Ke Zhao has used this month’s quota',
    },
    href: '/console/organization',
    unread: true,
  },
  {
    id: 'n-3',
    ts: dayStart('2026-09-10') + 18 * HOUR_MS,
    title: {
      zh: '密钥「数据标注」已暂停',
      en: 'Key “数据标注” was paused',
    },
    href: '/console/keys',
    unread: false,
  },
];
