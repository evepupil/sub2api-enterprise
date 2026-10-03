import { useTranslations } from 'next-intl';

import { Container } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { formatAmount, getEdition, groupsFor } from '@/lib/catalog';
import {
  PREVIEW_GROUP_SPEND,
  PREVIEW_MODEL_SHARE,
  PREVIEW_RECENT,
  PREVIEW_STATS,
} from '@/lib/content/console-preview';
import { SITE } from '@/lib/site';

import {
  Activity,
  ChartColumn,
  Gauge,
  KeyRound,
  Layers,
  LayoutDashboard,
  Search,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { ConsolePreviewDailyChart } from './console-preview-daily-chart';
import { ConsolePreviewGroupsChart } from './console-preview-groups-chart';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type NavKey = 'overview' | 'keys' | 'usage' | 'billing' | 'groups' | 'members' | 'settings';

const NAV_ITEMS: readonly { key: NavKey; icon: LucideIcon }[] = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'keys', icon: KeyRound },
  { key: 'usage', icon: ChartColumn },
  { key: 'billing', icon: Wallet },
  { key: 'groups', icon: Layers },
  { key: 'members', icon: Users },
  { key: 'settings', icon: Settings },
];

/** 数字卡的上升趋势行；变化百分比从数据层取 */
function Delta({ value }: { value: number }) {
  return (
    <p className="mt-1 inline-flex items-center gap-1 text-xs text-success">
      <TrendingUp aria-hidden className="size-3.5" />
      <span className="tabular-nums">+{value.toFixed(1)}%</span>
    </p>
  );
}

function StatCard({
  title,
  desc,
  icon: Icon,
  value,
  children,
}: {
  title: string;
  desc: string;
  icon: LucideIcon;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{desc}</p>
      <p className="mt-3 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground md:text-2xl">
        {value}
      </p>
      {children}
    </div>
  );
}

export function ConsolePreview() {
  const t = useTranslations('homeHero.preview');

  const stats = PREVIEW_STATS;
  const spend = `$${stats.monthSpendUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const tokens = `${(stats.tokens / 1e9).toFixed(2)}B`;
  const slaTarget = getEdition('pro').slaTarget.toFixed(1);

  // 环形图的图例要显示分组名，按 kind 对上专业版的四个分组
  const proGroups = groupsFor('pro');
  const spendGroups = PREVIEW_GROUP_SPEND.map((row) => {
    const group = proGroups.find((g) => g.kind === row.kind);
    return {
      kind: row.kind,
      percent: row.percent,
      name: group ? group.name : { zh: row.kind, en: row.kind },
    };
  });

  return (
    <section id="preview" className="relative pb-20 md:pb-28">
      <Container>
        <div
          data-console-preview
          className="relative mx-auto max-w-6xl rounded-[32px] border border-border bg-muted/70 p-2 shadow-card md:p-3"
        >
          <div className="relative h-[540px] overflow-hidden rounded-[24px] border border-border bg-card md:h-[620px]">
            <div className="grid h-full md:grid-cols-[220px_1fr]">
              <aside className="hidden border-r border-border bg-surface p-4 md:block">
                <div className="flex items-center gap-2 px-2 pb-6 text-sm font-semibold text-foreground">
                  <span aria-hidden className="block h-4 w-5 rounded bg-primary" />
                  {SITE.name}
                </div>
                <nav aria-label={t('title')}>
                  <ul className="space-y-1">
                    {NAV_ITEMS.map((item, i) => {
                      const active = i === 0;
                      return (
                        <li
                          key={item.key}
                          className={
                            active
                              ? 'flex items-center gap-2.5 rounded-md bg-muted px-2 py-1.5 text-[13px] font-medium text-foreground'
                              : 'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground'
                          }
                        >
                          <item.icon aria-hidden className="size-4 shrink-0" />
                          {t(`nav.${item.key}`)}
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </aside>
              <div className="flex min-w-0 flex-col">
                <div className="flex h-12 items-center justify-between border-b border-border px-4">
                  <p className="text-sm font-semibold text-foreground">{t('title')}</p>
                  <div className="flex items-center gap-2">
                    {/* 画出来的假搜索框，不可交互，对读屏隐藏 */}
                    <div
                      aria-hidden
                      className="hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-subtle-foreground sm:flex"
                    >
                      <Search className="size-3.5 shrink-0" />
                      <span className="truncate">{t('search')}</span>
                    </div>
                    <Badge tone="dark">{t('edition')}</Badge>
                    {/* 头像只是色块装饰 */}
                    <span aria-hidden className="size-7 shrink-0 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="space-y-3 p-3 md:space-y-4 md:p-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      title={t('stats.spend.title')}
                      desc={t('stats.spend.desc')}
                      icon={Wallet}
                      value={spend}
                    >
                      <Delta value={stats.monthSpendDelta} />
                    </StatCard>
                    <StatCard
                      title={t('stats.requests.title')}
                      desc={t('stats.requests.desc')}
                      icon={Activity}
                      value={stats.requests.toLocaleString('en-US')}
                    >
                      <Delta value={stats.requestsDelta} />
                    </StatCard>
                    <StatCard
                      title={t('stats.tokens.title')}
                      desc={t('stats.tokens.desc')}
                      icon={Layers}
                      value={tokens}
                    >
                      <Delta value={stats.tokensDelta} />
                    </StatCard>
                    <StatCard
                      title={t('stats.availability.title')}
                      desc={t('stats.availability.desc')}
                      icon={Gauge}
                      value={`${stats.availability}%`}
                    >
                      <p className="mt-1 text-xs text-subtle-foreground">
                        {t('stats.availability.target', { value: slaTarget })}
                      </p>
                    </StatCard>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="min-w-0 rounded-xl border border-border bg-card p-3 md:p-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('charts.daily.title')}
                      </h3>
                      <p className="text-xs text-muted-foreground">{t('charts.daily.unit')}</p>
                      <ConsolePreviewDailyChart />
                    </div>
                    <div className="min-w-0 rounded-xl border border-border bg-card p-3 md:p-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('charts.models.title')}
                      </h3>
                      <p className="text-xs text-muted-foreground">{t('charts.models.range')}</p>
                      <div className="mt-4 space-y-3">
                        {PREVIEW_MODEL_SHARE.map((row) => (
                          <div
                            key={row.model}
                            className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"
                          >
                            <span className="truncate text-xs text-foreground">{row.model}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {row.percent}%
                            </span>
                            <span className="col-span-2 h-1.5 rounded-full bg-muted">
                              <span
                                className="block h-full rounded-full bg-chart-1"
                                style={{ width: `${row.percent}%` }}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-xl border border-border bg-card p-3 md:p-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('charts.groups.title')}
                      </h3>
                      <p className="text-xs text-muted-foreground">{t('charts.groups.edition')}</p>
                      <ConsolePreviewGroupsChart groups={spendGroups} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card">
                    <h3 className="px-4 py-3 text-sm font-semibold text-foreground">
                      {t('recent.title')}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-subtle-foreground">
                            {[
                              t('recent.time'),
                              t('recent.model'),
                              t('recent.tokens'),
                              t('recent.cost'),
                              t('recent.status'),
                            ].map((label) => (
                              <th
                                key={label}
                                scope="col"
                                className="whitespace-nowrap px-4 py-2 text-left font-medium"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PREVIEW_RECENT.map((row) => (
                            <tr key={`${row.time}-${row.model}`} className="border-t border-border">
                              <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                                {row.time}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 font-mono text-foreground">
                                {row.model}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                                {row.tokens === 0 ? '—' : row.tokens.toLocaleString('en-US')}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                                ${formatAmount(row.costUsd)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2">
                                {row.ok ? (
                                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <span
                                      aria-hidden
                                      className="size-1.5 rounded-full bg-success-graphic"
                                    />
                                    {t('recent.ok')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <span
                                      aria-hidden
                                      className="size-1.5 rounded-full bg-danger-graphic"
                                    />
                                    {t('recent.failed')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* 画面下半部慢慢淡出，和模板首屏下方的截图一致 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 rounded-b-[32px] bg-gradient-to-b from-transparent to-background"
          />
        </div>
      </Container>
    </section>
  );
}

export default ConsolePreview;
