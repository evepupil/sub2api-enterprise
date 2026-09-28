import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';
import { marketingContent } from '@/content/marketing';

import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: marketingContent.brand.name,
    template: `%s · ${marketingContent.brand.name}`,
  },
  description: marketingContent.hero.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
