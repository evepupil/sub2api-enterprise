'use client';

import { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ConsoleShell } from '../components/layout/console-shell';
import { PageHeader } from '../components/layout/page-header';
import { PublicShell } from '../components/layout/public-shell';
import { getConsoleNavigation, isNavigationActive, type Audience } from '../lib/navigation';
import type { DateRange } from 'react-day-picker';
import type { PreviewKey } from './fixtures';
import { initialKeys, previewDateRange, previewMetrics } from './fixtures';
import { ComponentsPreview } from './components-preview';
import { DateRangeControl } from './date-range-preview';
import { FeedbackPreview } from './feedback-preview';
import { KeysPreviewTable } from './keys-preview-table';

const views = [
  { id: 'components', label: '组件' },
  { id: 'public', label: '官网外壳' },
  { id: 'console', label: '控制台外壳' },
] as const;

type PreviewView = (typeof views)[number]['id'];

const publicTitles: Record<string, string> = {
  '/': '首页',
  '/catalog': '模型',
  '/status': '服务状态',
  '/help': '帮助',
  '/login': '登录',
};

export function FoundationPreview() {
  const [view, setView] = useState<PreviewView>('components');
  const [keys, setKeys] = useState<PreviewKey[]>(() => [...initialKeys]);
  const [audience, setAudience] = useState<Audience>('personal');
  const [publicPath, setPublicPath] = useState('/catalog');
  const [consolePath, setConsolePath] = useState('/console');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(previewDateRange);
  const publicTitle = publicTitles[publicPath] ?? '帮助';
  const consoleItem = getConsoleNavigation(audience)
    .filter((item) => isNavigationActive(consolePath, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];

  function saveKey(name: string) {
    setKeys((current) => [
      ...current,
      {
        id: `preview-${current.length + 1}`,
        name,
        status: 'active',
        spent: '$0.00',
        expiresAt: '未设置',
      },
    ]);
  }

  function navigatePublic(href: string) {
    if (href === '/console') {
      setConsolePath('/console');
      setView('console');
      return;
    }
    setPublicPath(href);
  }

  function changeAudience(value: string) {
    if (value !== 'personal' && value !== 'owner' && value !== 'member') return;
    const nextAudience: Audience = value;
    setAudience(nextAudience);
    if (
      !getConsoleNavigation(nextAudience).some((item) => isNavigationActive(consolePath, item.href))
    ) {
      setConsolePath('/console');
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="min-h-16 border-b border-border bg-background">
        <div className="mx-auto flex min-h-16 max-w-site flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap md:px-8 xl:px-16">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold">界面预览</h1>
            <Badge variant="neutral">示例数据</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="预览视图" className="flex flex-wrap gap-1">
              {views.map((item) => (
                <Button
                  key={item.id}
                  data-testid={`preview-view-${item.id}`}
                  type="button"
                  size="sm"
                  variant={view === item.id ? 'default' : 'ghost'}
                  aria-pressed={view === item.id}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </nav>
            {view === 'console' ? (
              <Select value={audience} onValueChange={changeAudience}>
                <SelectTrigger aria-label="预览身份" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">个人账户</SelectItem>
                  <SelectItem value="owner">组织管理员</SelectItem>
                  <SelectItem value="member">成员</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>
      </header>

      {view === 'components' ? (
        <main className="mx-auto w-full max-w-site px-4 py-8 md:px-8 xl:px-16">
          <ComponentsPreview
            rows={keys}
            onKeyCreate={saveKey}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </main>
      ) : null}

      {view === 'public' ? (
        <PublicShell activePath={publicPath} onNavigate={navigatePublic}>
          <div className="space-y-6 py-8">
            <PageHeader title={publicTitle} />
            <section aria-label="示例数据" className="min-w-0">
              <KeysPreviewTable rows={keys} />
            </section>
          </div>
        </PublicShell>
      ) : null}

      {view === 'console' ? (
        <ConsoleShell
          audience={audience}
          activePath={consolePath}
          accountLabel={audience === 'personal' ? '个人账户' : '组织账户'}
          onNavigate={setConsolePath}
        >
          <div className="space-y-6">
            <PageHeader
              title={consoleItem?.label ?? '概览'}
              actions={<DateRangeControl value={dateRange} onChange={setDateRange} />}
            />
            <section
              aria-label="示例汇总"
              className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {previewMetrics.map((metric) => (
                <Card key={metric.label}>
                  <CardContent className="space-y-2 p-5">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="break-words text-xl font-semibold tabular-nums">{metric.value}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
            <section aria-label="密钥示例" className="min-w-0">
              <Card>
                <CardContent className="min-w-0 p-0">
                  <KeysPreviewTable rows={keys} />
                </CardContent>
              </Card>
            </section>
            <FeedbackPreview rows={keys} />
          </div>
        </ConsoleShell>
      ) : null}
    </div>
  );
}
