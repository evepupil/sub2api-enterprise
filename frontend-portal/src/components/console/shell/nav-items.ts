import {
  BookOpen,
  ChartColumn,
  CreditCard,
  Gift,
  KeyRound,
  Layers,
  LifeBuoy,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { SITE_FEATURES } from '@/lib/site';

export type ConsoleNavKey =
  'usage' | 'models' | 'logs' | 'keys' | 'billing' | 'invite' | 'organization' | 'docs' | 'support';

/**
 * 侧边栏菜单，顺序即显示顺序；文字取 console.nav.<key>。
 * 文档仍是官网的占位页（不在 /console 下），官网的文档入口没开时不显示。
 */
export const CONSOLE_NAV: readonly { key: ConsoleNavKey; href: string; icon: LucideIcon }[] = [
  { key: 'usage', href: '/console/usage', icon: ChartColumn },
  { key: 'models', href: '/console/models', icon: Layers },
  { key: 'logs', href: '/console/logs', icon: ScrollText },
  { key: 'keys', href: '/console/keys', icon: KeyRound },
  { key: 'billing', href: '/console/billing', icon: CreditCard },
  { key: 'invite', href: '/console/invite', icon: Gift },
  { key: 'organization', href: '/console/organization', icon: Users },
  { key: 'docs', href: '/docs', icon: BookOpen },
  { key: 'support', href: '/console/support', icon: LifeBuoy },
];

/**
 * 实际显示的菜单，和 sub2api 原来的用户菜单一致：后台没开邀请返利（或还没读到开关）时不显示「邀请」；
 * 「组织」只给组织管理员，个人用户、普通成员（以及还没读到当前用户时）都不显示；
 * 「文档」跟着官网的文档入口开关（src/lib/site.ts，首发关着）。
 */
export function visibleNav(
  affiliateEnabled: boolean | null,
  orgOwner: boolean,
): typeof CONSOLE_NAV {
  return CONSOLE_NAV.filter(
    (item) =>
      (item.key !== 'invite' || affiliateEnabled === true) &&
      (item.key !== 'organization' || orgOwner) &&
      (item.key !== 'docs' || SITE_FEATURES.docs),
  );
}

/** 当前地址是否属于某个菜单项（子页面也算） */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
