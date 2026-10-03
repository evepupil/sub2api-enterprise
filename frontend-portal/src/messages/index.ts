import type { AppLocale } from '@/i18n/routing';

import enAuth from './en/auth.json';
import enCommon from './en/common.json';
import enGroups from './en/groups.json';
import enHomeHero from './en/homeHero.json';
import enHomeMore from './en/homeMore.json';
import enHomeShowcase from './en/homeShowcase.json';
import enMisc from './en/misc.json';
import enModels from './en/models.json';
import enPricing from './en/pricing.json';
import zhAuth from './zh/auth.json';
import zhCommon from './zh/common.json';
import zhGroups from './zh/groups.json';
import zhHomeHero from './zh/homeHero.json';
import zhHomeMore from './zh/homeMore.json';
import zhHomeShowcase from './zh/homeShowcase.json';
import zhMisc from './zh/misc.json';
import zhModels from './zh/models.json';
import zhPricing from './zh/pricing.json';

/**
 * 文案按命名空间拆文件：common 归公共外壳，其余每个文件归一路页面实现。
 * 中文是类型基准，英文必须和中文的键完全一致（tests/messages.test.ts 校验）。
 */
const zh = {
  common: zhCommon,
  homeHero: zhHomeHero,
  homeShowcase: zhHomeShowcase,
  homeMore: zhHomeMore,
  models: zhModels,
  pricing: zhPricing,
  groups: zhGroups,
  auth: zhAuth,
  misc: zhMisc,
};

export type Messages = typeof zh;

const en: Messages = {
  common: enCommon,
  homeHero: enHomeHero,
  homeShowcase: enHomeShowcase,
  homeMore: enHomeMore,
  models: enModels,
  pricing: enPricing,
  groups: enGroups,
  auth: enAuth,
  misc: enMisc,
};

export const messagesByLocale: Record<AppLocale, Messages> = { zh, en };

export function loadMessages(locale: AppLocale): Messages {
  return messagesByLocale[locale];
}
