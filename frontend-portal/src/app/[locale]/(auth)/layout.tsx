import type { ReactNode } from 'react';

/** 登录注册页的外壳：没有顶栏和页脚，整屏交给页面自己排版。 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="min-h-dvh">
      {children}
    </main>
  );
}
