import type { Metadata } from 'next';
import { AppProviders } from '@/components/app-providers';
import { marketingContent } from '@/content/marketing';
import { THEME_BOOTSTRAP_SCRIPT } from '@/features/theme/theme-bootstrap';

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
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
