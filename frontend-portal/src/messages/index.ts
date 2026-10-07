import type { AppLocale } from '@/i18n/routing';

import enAuth from './en/auth.json';
import enCommon from './en/common.json';
import enConsole from './en/console.json';
import enConsoleBilling from './en/consoleBilling.json';
import enConsoleChat from './en/consoleChat.json';
import enConsoleInvite from './en/consoleInvite.json';
import enConsoleKeys from './en/consoleKeys.json';
import enConsoleLogs from './en/consoleLogs.json';
import enConsoleModels from './en/consoleModels.json';
import enConsoleOrg from './en/consoleOrg.json';
import enConsoleSettings from './en/consoleSettings.json';
import enConsoleSupport from './en/consoleSupport.json';
import enConsoleUsage from './en/consoleUsage.json';
import enGroups from './en/groups.json';
import enHomeHero from './en/homeHero.json';
import enHomeMore from './en/homeMore.json';
import enHomeShowcase from './en/homeShowcase.json';
import enLegal from './en/legal.json';
import enMisc from './en/misc.json';
import enModels from './en/models.json';
import enPricing from './en/pricing.json';
import zhAuth from './zh/auth.json';
import zhCommon from './zh/common.json';
import zhConsole from './zh/console.json';
import zhConsoleBilling from './zh/consoleBilling.json';
import zhConsoleChat from './zh/consoleChat.json';
import zhConsoleInvite from './zh/consoleInvite.json';
import zhConsoleKeys from './zh/consoleKeys.json';
import zhConsoleLogs from './zh/consoleLogs.json';
import zhConsoleModels from './zh/consoleModels.json';
import zhConsoleOrg from './zh/consoleOrg.json';
import zhConsoleSettings from './zh/consoleSettings.json';
import zhConsoleSupport from './zh/consoleSupport.json';
import zhConsoleUsage from './zh/consoleUsage.json';
import zhGroups from './zh/groups.json';
import zhHomeHero from './zh/homeHero.json';
import zhHomeMore from './zh/homeMore.json';
import zhHomeShowcase from './zh/homeShowcase.json';
import zhLegal from './zh/legal.json';
import zhMisc from './zh/misc.json';
import zhModels from './zh/models.json';
import zhPricing from './zh/pricing.json';

/**
 * 文案按命名空间拆文件：common 归公共外壳，console 归控制台外壳，其余每个文件归一个页面或一路实现。
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
  legal: zhLegal,
  console: zhConsole,
  consoleChat: zhConsoleChat,
  consoleUsage: zhConsoleUsage,
  consoleModels: zhConsoleModels,
  consoleLogs: zhConsoleLogs,
  consoleKeys: zhConsoleKeys,
  consoleBilling: zhConsoleBilling,
  consoleInvite: zhConsoleInvite,
  consoleOrg: zhConsoleOrg,
  consoleSupport: zhConsoleSupport,
  consoleSettings: zhConsoleSettings,
};

export type Messages = typeof zh;
export type Namespace = keyof Messages;

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
  legal: enLegal,
  console: enConsole,
  consoleChat: enConsoleChat,
  consoleUsage: enConsoleUsage,
  consoleModels: enConsoleModels,
  consoleLogs: enConsoleLogs,
  consoleKeys: enConsoleKeys,
  consoleBilling: enConsoleBilling,
  consoleInvite: enConsoleInvite,
  consoleOrg: enConsoleOrg,
  consoleSupport: enConsoleSupport,
  consoleSettings: enConsoleSettings,
};

export const messagesByLocale: Record<AppLocale, Messages> = { zh, en };

export function loadMessages(locale: AppLocale): Messages {
  return messagesByLocale[locale];
}

/** 官网页面（含登录注册、404）在浏览器里用到的命名空间 */
export const SITE_NAMESPACES = [
  'common',
  'homeHero',
  'homeShowcase',
  'homeMore',
  'models',
  'pricing',
  'groups',
  'auth',
  'misc',
] as const satisfies readonly Namespace[];

/** 控制台在浏览器里用到的命名空间（语言与主题切换还要 common） */
export const CONSOLE_NAMESPACES = [
  'common',
  'console',
  'consoleChat',
  'consoleUsage',
  'consoleModels',
  'consoleLogs',
  'consoleKeys',
  'consoleBilling',
  'consoleInvite',
  'consoleOrg',
  'consoleSupport',
  'consoleSettings',
] as const satisfies readonly Namespace[];

/** 只把需要的命名空间交给浏览器，官网页面不带控制台的文案，反之亦然 */
export function pickMessages<K extends Namespace>(
  messages: Messages,
  namespaces: readonly K[],
): Pick<Messages, K> {
  const picked = {} as Pick<Messages, K>;
  for (const namespace of namespaces) picked[namespace] = messages[namespace];
  return picked;
}
