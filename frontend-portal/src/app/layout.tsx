import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SITE } from '@/lib/site';

/** 页面里的相对地址（规范网址、中英文对应地址、分享卡片图）都按官网正式地址补全 */
export const metadata: Metadata = { metadataBase: new URL(SITE.url) };

/**
 * 真正的根布局在 [locale]/layout.tsx（按语言输出 <html lang>）。
 * 这里只为根目录的 not-found 提供挂载点，原样透传。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
