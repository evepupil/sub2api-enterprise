'use client';

import { useState } from 'react';

import { Activity, ArrowUpRight, BookOpen, KeyRound, Search, WalletCards } from 'lucide-react';
import { MarketingLink } from '../../components/marketing/marketing-link';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import type { PublicSettings } from '../public/types';
import { helpArticles } from './articles';

const categories = ['接入', '账户与用量', '公告'] as const;
type HelpCategory = (typeof categories)[number];

const helpTasks = [
  {
    href: '/console/keys',
    title: '创建第一个密钥',
    description: '为项目分配独立密钥，设置范围、额度和有效期。',
    icon: KeyRound,
  },
  {
    href: '/catalog',
    title: '查找模型价格',
    description: '按厂家和模型代号比较输入、缓存与输出价格。',
    icon: BookOpen,
  },
  {
    href: '/console/usage',
    title: '查看实际用量',
    description: '按日期查看请求、Token、消费和模型分布。',
    icon: WalletCards,
  },
  {
    href: '/status',
    title: '确认服务状态',
    description: '查看可用率、当前响应耗时和近期探测记录。',
    icon: Activity,
  },
] as const;

export function HelpView({ settings }: { settings: PublicSettings }) {
  const [category, setCategory] = useState<HelpCategory>('接入');
  const [articleId, setArticleId] = useState('getting-started');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleArticles = helpArticles.filter((item) => {
    if (item.category !== category) {
      return false;
    }
    if (normalizedQuery === '') {
      return true;
    }
    return [item.title, ...item.paragraphs, ...(item.steps ?? [])].some((text) =>
      text.toLowerCase().includes(normalizedQuery),
    );
  });
  const article = visibleArticles.find((item) => item.id === articleId) ?? visibleArticles[0];

  function selectCategory(next: HelpCategory) {
    setCategory(next);
    setArticleId(helpArticles.find((item) => item.category === next)?.id ?? '');
  }

  return (
    <div className="public-page public-page-help space-y-8">
      <section className="public-page-hero" data-slot="marketing-hero" aria-labelledby="help-title">
        <div className="public-page-hero-row">
          <div className="public-page-hero-copy">
            <p className="public-page-eyebrow">帮助中心 / DOCS</p>
            <h1 id="help-title" className="public-page-title">
              从第一个密钥，到稳定运行。
            </h1>
            <p className="public-page-description">
              把接入、账户、用量和状态放在一条清晰路径里，需要哪一步，直接从这里开始。
            </p>
          </div>
          {settings.documentationUrl ? (
            <MarketingLink
              href={settings.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              arrow
            >
              完整接入文档
            </MarketingLink>
          ) : null}
        </div>
        <div className="help-search-row">
          <label htmlFor="help-search">搜索当前分类</label>
          <div className="help-search-wrap">
            <Search aria-hidden="true" className="help-search-icon" />
            <Input
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="搜索当前分类中的内容"
              className="pl-10"
            />
          </div>
        </div>
      </section>

      <section className="help-task-section" aria-labelledby="help-task-title">
        <div className="help-section-heading">
          <p className="public-page-eyebrow">常用任务</p>
          <h2 id="help-task-title">从你正在做的事开始。</h2>
        </div>
        <div className="help-task-grid">
          {helpTasks.map((task) => {
            const Icon = task.icon;
            return (
              <a key={task.href} href={task.href} className="help-task-card">
                <span className="help-task-icon" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="help-task-copy">
                  <span className="help-task-title">{task.title}</span>
                  <span className="help-task-description">{task.description}</span>
                </span>
                <ArrowUpRight className="help-task-arrow" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </section>

      <section className="help-article-section" aria-labelledby="help-article-title">
        <div className="help-section-heading">
          <p className="public-page-eyebrow">帮助文章</p>
          <h2 id="help-article-title">把常见问题说清楚。</h2>
        </div>
        <div role="group" aria-label="帮助分类" className="help-category-tabs">
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
          <EmptyState className="help-empty-state" title="暂无公开公告" />
        ) : article ? (
          <div className="help-article-layout">
            <nav aria-label="帮助文章" className="help-article-nav">
              {visibleArticles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={article.id === item.id ? 'page' : undefined}
                  onClick={() => setArticleId(item.id)}
                  className={cn('help-article-nav-item', article.id === item.id && 'is-active')}
                >
                  {item.title}
                </button>
              ))}
            </nav>
            <Card className="help-article-card min-w-0">
              <CardContent className="space-y-6 p-6 md:p-8" aria-live="polite">
                <article id={article.id} className="help-article-content min-w-0">
                  <p className="help-article-kicker">{category}</p>
                  <h3>{article.title}</h3>
                  {article.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {article.steps ? (
                    <ol>
                      {article.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                </article>
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState
            title="没有匹配的文章"
            description="换一个关键词，或清空搜索后查看全部帮助内容。"
            action={
              <Button variant="outline" onClick={() => setQuery('')}>
                清空搜索
              </Button>
            }
          />
        )}
      </section>

      {settings.contactInfo ? (
        <section className="help-contact" aria-labelledby="contact-title">
          <h2 id="contact-title">需要进一步帮助？</h2>
          <p>{settings.contactInfo}</p>
        </section>
      ) : null}
    </div>
  );
}
