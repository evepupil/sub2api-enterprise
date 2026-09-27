import type { ReactNode } from 'react';
import Link from 'next/link';

import { Brand } from '../../components/layout/brand';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Shared account shell: a quiet brand header and one readable form surface. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-header w-full max-w-site items-center justify-between gap-4 px-4 md:px-8 xl:px-16">
          <Brand href="/" name="模型服务" />
          <Link
            href="/"
            className="inline-flex h-touch items-center rounded-control px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-control"
          >
            返回首页
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-dialog flex-col px-4 py-10 md:py-16">
        <Card className="w-full gap-5">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description !== undefined ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </main>
    </div>
  );
}
