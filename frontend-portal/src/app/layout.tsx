import type { Metadata } from 'next';

import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: '模型服务',
    template: '%s · 模型服务',
  },
  description: '模型服务门户与客户控制台。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
