'use client';

import { useState } from 'react';

import { PageHeader } from '../../components/layout/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { cn } from '../../lib/utils';
import type { PublicSettings } from '../public/types';
import { helpArticles } from './articles';

const categories = ['接入', '账户与用量', '公告'] as const;
type HelpCategory = (typeof categories)[number];

export function HelpView({ settings }: { settings: PublicSettings }) {
  const [category, setCategory] = useState<HelpCategory>('接入');
  const [articleId, setArticleId] = useState('getting-started');
  const visibleArticles = helpArticles.filter((article) => article.category === category);
  const article = visibleArticles.find((item) => item.id === articleId) ?? visibleArticles[0];

  function selectCategory(next: HelpCategory) {
    setCategory(next);
    setArticleId(helpArticles.find((item) => item.category === next)?.id ?? '');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="帮助中心"
        actions={
          settings.documentationUrl ? (
            <Button asChild variant="outline">
              <a href={settings.documentationUrl} target="_blank" rel="noopener noreferrer">
                完整接入文档
              </a>
            </Button>
          ) : undefined
        }
      />
      <div role="group" aria-label="帮助分类" className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <Button
            key={item}
            variant={category === item ? 'default' : 'outline'}
            aria-pressed={category === item}
            onClick={() => selectCategory(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      {category === '公告' ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState title="暂无公开公告" />
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-w-0 flex-col gap-6 md:flex-row">
          <nav
            aria-label="帮助文章"
            className="flex min-w-0 flex-wrap gap-2 md:w-sidebar md:shrink-0 md:flex-col"
          >
            {visibleArticles.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={article?.id === item.id ? 'page' : undefined}
                onClick={() => setArticleId(item.id)}
                className={cn(
                  'min-h-11 rounded-control px-4 py-3 text-left text-sm transition-colors hover:bg-secondary',
                  article?.id === item.id
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {item.title}
              </button>
            ))}
          </nav>
          {article ? (
            <Card className="min-w-0 flex-1">
              <CardContent className="space-y-6 p-6 md:p-8" aria-live="polite">
                <article id={article.id} className="min-w-0 space-y-6">
                  <h2 className="break-words text-xl font-semibold">{article.title}</h2>
                  {article.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="break-words text-base leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                  {article.steps ? (
                    <ol className="list-decimal space-y-3 pl-5 text-base leading-relaxed">
                      {article.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                </article>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
      {settings.contactInfo ? (
        <section className="space-y-2 border-t border-border pt-6" aria-labelledby="contact-title">
          <h2 id="contact-title" className="text-base font-medium">
            联系客服
          </h2>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {settings.contactInfo}
          </p>
        </section>
      ) : null}
    </div>
  );
}
