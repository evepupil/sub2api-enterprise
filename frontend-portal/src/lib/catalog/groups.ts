import type { AppLocale } from '@/i18n/routing';

import { getEdition } from './editions';
import type { EditionId, Localized } from './types';

/**
 * 通道倍率的写法与三种通道的权益。倍率存在通道数据里（editions.ts），这里放倍率的取值与写法
 * （价格换算和控制台用，官网通道页不展示倍率）；权益是用户 2026-10-07 给定的，不写并发、限额这类数字。
 */

const text = (zh: string, en: string = zh): Localized => ({ zh, en });

/** 某版本的分组倍率；null 表示按合同定制 */
export function editionRatio(edition: EditionId): number | null {
  return getEdition(edition).ratio;
}

/** 倍率文字：整数补一位小数（×1.0），其余原样（×0.15、×0.3） */
export function ratioLabel(ratio: number): string {
  return `×${Number.isInteger(ratio) ? ratio.toFixed(1) : String(ratio)}`;
}

/** 倍率的中英文写法；定制显示「定制」 */
export function ratioText(ratio: number | null): Localized {
  return ratio === null ? text('定制', 'Custom') : text(ratioLabel(ratio));
}

export function formatRatio(ratio: number | null, locale: AppLocale): string {
  return ratioText(ratio)[locale];
}

/** 通道卡的权益清单：每个通道比上一档多出来的几条（卡片上排在「包含上一档全部权益」之后） */
export const GROUP_HIGHLIGHTS: Record<EditionId, readonly Localized[]> = {
  personal: [
    text('全部文本模型', 'All text models'),
    text('全部生图模型', 'All image models'),
    text('7 天内可退款', 'Refunds within 7 days'),
    text('客服 24 小时在线', '24/7 support'),
    text('基础安全防护', 'Basic security protection'),
  ],
  pro: [
    text('ChatGPT 专业通道', 'ChatGPT Pro channel'),
    text('高可用、低延迟、不降智', 'High availability, low latency, full-strength models'),
    text('专属客服 24 小时一对一', 'Dedicated 24/7 one-on-one support'),
  ],
  enterprise: [
    text('可开发票', 'Invoices'),
    text('定制安全防护', 'Custom security protection'),
    text('企业级管理功能', 'Enterprise management features'),
    text('专属客户经理', 'Dedicated account manager'),
    text('可选私有化部署', 'Optional private deployment'),
  ],
};

/** 特权对比表的一格：布尔值画对勾 / 横线，文本原样显示 */
export type PrivilegeCell = boolean | Localized;

export interface PrivilegeRow {
  id: string;
  label: Localized;
  values: Record<EditionId, PrivilegeCell>;
}

const yes = true;
const no = false;

/**
 * 三种通道的权益对比（通道页对比表）：和通道卡的清单一一对应，上一档有的下一档都有；
 * 只比权益，不比倍率，不写可用率承诺和并发、限额这类数字。
 */
export const PRIVILEGE_ROWS: readonly PrivilegeRow[] = [
  {
    id: 'text-models',
    label: text('全部文本模型', 'All text models'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'image-models',
    label: text('全部生图模型', 'All image models'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'refund',
    label: text('7 天内可退款', 'Refunds within 7 days'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'security',
    label: text('安全防护', 'Security protection'),
    values: {
      personal: text('基础', 'Basic'),
      pro: text('基础', 'Basic'),
      enterprise: text('可定制', 'Custom'),
    },
  },
  {
    id: 'chatgpt-pro',
    label: text('ChatGPT 专业通道', 'ChatGPT Pro channel'),
    values: { personal: no, pro: yes, enterprise: yes },
  },
  {
    id: 'quality',
    label: text('高可用、低延迟、不降智', 'High availability, low latency, full-strength models'),
    values: { personal: no, pro: yes, enterprise: yes },
  },
  {
    id: 'support',
    label: text('客服', 'Support'),
    values: {
      personal: text('24 小时在线', '24/7'),
      pro: text('24 小时一对一', '24/7 one-on-one'),
      enterprise: text('24 小时一对一', '24/7 one-on-one'),
    },
  },
  {
    id: 'invoice',
    label: text('开发票', 'Invoices'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'management',
    label: text('企业级管理功能', 'Enterprise management features'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'manager',
    label: text('专属客户经理', 'Dedicated account manager'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'private',
    label: text('私有化部署', 'Private deployment'),
    values: { personal: no, pro: no, enterprise: text('可选', 'Optional') },
  },
];
