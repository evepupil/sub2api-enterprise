import type { AppLocale } from '@/i18n/routing';

import { getEdition } from './editions';
import type { EditionId, Localized } from './types';

/**
 * 通道倍率与特权（占位数据）。一个通道就是一个分组，倍率存在通道数据里（editions.ts）；
 * 这里放倍率的取值与写法（价格换算和控制台用，官网通道页不展示倍率）、通道卡上的特权清单、三种通道的特权对比表。
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

/** 通道卡特权清单里各通道独有的几条，排在限额、工单之后 */
export const GROUP_HIGHLIGHTS: Record<EditionId, readonly Localized[]> = {
  personal: [
    text('全部文本与生图模型', 'Every text and image model'),
    text('故障自动切换', 'Automatic failover'),
  ],
  pro: [
    text('高峰期优先调度', 'Priority scheduling at peak hours'),
    text('对公转账与发票', 'Bank transfer and invoices'),
  ],
  enterprise: [
    text('可用率赔付', 'SLA credits'),
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
const thousands = (n: number): Localized => text(n.toLocaleString('en-US'));
const sla = (id: EditionId): Localized => text(`${getEdition(id).slaTarget.toFixed(1)}%`);
const hours = (id: EditionId): Localized => {
  const h = getEdition(id).supportHours;
  return text(`${h} 小时`, `${h} ${h === 1 ? 'hour' : 'hours'}`);
};

/** 三种通道的特权对比（通道页对比表），只比权益不比倍率；可用率与额度直接从数据推出，不另写一份 */
export const PRIVILEGE_ROWS: readonly PrivilegeRow[] = [
  {
    id: 'sla',
    label: text('可用率目标', 'Availability target'),
    values: { personal: sla('personal'), pro: sla('pro'), enterprise: sla('enterprise') },
  },
  {
    id: 'rpm',
    label: text('单密钥每分钟请求数', 'Requests per minute per key'),
    values: {
      personal: thousands(getEdition('personal').rpm),
      pro: thousands(getEdition('pro').rpm),
      enterprise: thousands(getEdition('enterprise').rpm),
    },
  },
  {
    id: 'concurrency',
    label: text('并发上限', 'Concurrency limit'),
    values: {
      personal: thousands(getEdition('personal').concurrency),
      pro: thousands(getEdition('pro').concurrency),
      enterprise: thousands(getEdition('enterprise').concurrency),
    },
  },
  {
    id: 'failover',
    label: text('故障自动切换', 'Automatic failover'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'priority',
    label: text('优先调度', 'Priority scheduling'),
    values: { personal: no, pro: yes, enterprise: yes },
  },
  {
    id: 'members',
    label: text('组织成员上限', 'Organization members'),
    values: { personal: text('3'), pro: text('20'), enterprise: text('不限', 'Unlimited') },
  },
  {
    id: 'export',
    label: text('用量明细导出', 'Usage export'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'invoice',
    label: text('对公转账与发票', 'Bank transfer and invoices'),
    values: { personal: no, pro: yes, enterprise: yes },
  },
  {
    id: 'credits',
    label: text('可用率赔付', 'SLA credits'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'manager',
    label: text('专属客户经理', 'Dedicated account manager'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'support',
    label: text('工单响应', 'Support response'),
    values: { personal: hours('personal'), pro: hours('pro'), enterprise: hours('enterprise') },
  },
];
