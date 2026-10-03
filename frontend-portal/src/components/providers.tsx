'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

/** 全站客户端上下文：明暗主题（写在 <html class> 上，默认亮色，记住访客的选择）。 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
