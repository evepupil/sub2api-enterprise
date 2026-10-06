'use client';

import { hasLocale, useLocale } from 'next-intl';

import { usePathname, useRouter } from './navigation';
import { routing } from './routing';

/**
 * 切换界面语言：留在当前页，并保留网址里的查询参数（如 ?currency=cny）。
 * 官网顶栏的语言下拉和控制台头像菜单共用；传入的不是支持的语言或就是当前语言时什么也不做。
 */
export function useSwitchLocale(): (next: string) => void {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (next: string) => {
    if (!hasLocale(routing.locales, next) || next === locale) return;
    router.replace(`${pathname}${window.location.search}`, { locale: next, scroll: false });
  };
}
