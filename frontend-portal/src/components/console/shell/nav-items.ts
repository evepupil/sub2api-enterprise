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

export type ConsoleNavKey =
  'usage' | 'models' | 'logs' | 'keys' | 'billing' | 'invite' | 'organization' | 'docs' | 'tickets';

/**
 * 侧边栏菜单，顺序即显示顺序；文字取 console.nav.<key>。
 * 文档仍是官网的占位页（不在 /console 下）。
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
  { key: 'tickets', href: '/console/tickets', icon: LifeBuoy },
];

/** 当前地址是否属于某个菜单项（子页面也算） */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
