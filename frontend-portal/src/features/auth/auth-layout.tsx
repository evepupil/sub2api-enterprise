import type { ReactNode } from 'react';
import Link from 'next/link';

import { Brand } from '../../components/layout/brand';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { marketingContent } from '../../content/marketing';

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const showcaseStory = marketingContent.stories[0];

/** Shared account shell: a focused form with a product context on wider screens. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="auth-page min-h-dvh bg-background text-foreground">
      <header className="auth-header">
        <div className="auth-header-inner">
          <Brand href="/" name={marketingContent.brand.name} className="auth-mobile-brand" />
          <Link
            href="/"
            className="auth-home-link inline-flex h-touch items-center rounded-control px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-control"
          >
            返回首页
          </Link>
        </div>
      </header>
      <main className="auth-layout-shell">
        <aside className="auth-showcase">
          <Brand href="/" name={marketingContent.brand.name} />
          <p className="auth-showcase-eyebrow">你的 AI 工作空间</p>
          <h2>让每一次模型调用，都有清晰的起点。</h2>
          <p className="auth-showcase-description">{marketingContent.brand.tagline}</p>
          <ul className="auth-showcase-benefits">
            {marketingContent.hero.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          <figure className="auth-showcase-story">
            <blockquote>“{showcaseStory.quote}”</blockquote>
            <figcaption>
              <span>{showcaseStory.name}</span>
              <span>{showcaseStory.role}</span>
              <strong>
                {showcaseStory.result} · {showcaseStory.resultLabel}
              </strong>
            </figcaption>
          </figure>
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
