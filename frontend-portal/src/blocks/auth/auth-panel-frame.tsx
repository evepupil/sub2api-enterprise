import type { ReactNode } from 'react';

import { Brand } from '@/components/layout/brand';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';

/**
 * 登录、注册、找回密码、重置密码共用的左半边外框：最宽 448 的一列，顶上一行是品牌与语言、主题切换
 * （这几页没有顶栏），下面的内容上下居中。
 */
export function AuthPanelFrame({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="flex min-h-dvh flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">{children}</div>
      </div>
    </section>
  );
}
