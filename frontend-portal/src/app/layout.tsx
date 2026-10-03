import type { ReactNode } from 'react';

/**
 * 真正的根布局在 [locale]/layout.tsx（按语言输出 <html lang>）。
 * 这里只为根目录的 not-found 提供挂载点，原样透传。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
