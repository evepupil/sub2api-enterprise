import type { ReactNode } from 'react';
import Link from 'next/link';

import { Spotlight } from '../../components/effects/spotlight';
import { Brand } from '../../components/layout/brand';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { marketingContent } from '../../content/marketing';
import { ThemeSwitcher } from '../theme/theme-switcher';

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Shared account shell: a focused form with a product context on wider screens. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="auth-page min-h-dvh bg-background text-foreground">
      <header className="auth-header">
        <div className="auth-header-inner">
          <Brand href="/" name={marketingContent.brand.name} className="auth-mobile-brand" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <Link
              href="/"
              className="auth-home-link inline-flex h-touch items-center rounded-control px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-control"
            >
              返回首页
            </Link>
          </div>
        </div>
      </header>
      <main className="auth-layout-shell">
        <aside className="auth-showcase">
          {/* 复用首页聚光灯；展示区比首屏小，光束随之缩短、摆幅减小。 */}
          <Spotlight
            translateY={-300}
            width={480}
            height={1100}
            smallWidth={200}
            duration={12}
            xOffset={48}
          />
          <Brand href="/" name={marketingContent.brand.name} />
          <p className="auth-showcase-eyebrow">{marketingContent.hero.eyebrow}</p>
          <h2>{marketingContent.auth.title}</h2>
          <p className="auth-showcase-description">{marketingContent.brand.tagline}</p>
          <ul className="auth-showcase-benefits">
            {marketingContent.auth.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </aside>
        <section className="auth-form-column" aria-labelledby="auth-form-title">
          <Card className="auth-form-card w-full gap-5">
            <CardHeader>
              <p className="auth-form-kicker">{marketingContent.brand.name}</p>
              <h1 id="auth-form-title" className="auth-form-title">
                {title}
              </h1>
              {description !== undefined ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
