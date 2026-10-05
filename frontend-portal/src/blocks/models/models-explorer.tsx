'use client';

/**
 * 模型浏览器：模型与价格来自后台（官网服务器读好后传进来，见 src/lib/catalog/live.ts）。
 * 筛选、搜索、排序、类型切换全部存进网址参数，刷新和分享链接都保留；结果一律走 filterSiteModels / siteFacetCounts。
 * 企业通道按合同定价：列出专用通道的模型、价格写「定制」。后台读不到时只显示一句「暂时没有可展示的模型」。
 */

import { useState } from 'react';

import { ArrowUpDown, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';

import { ModelsExplorerCard } from './models-explorer-card';
import {
  CONTEXT_FILTERS,
  PROVIDERS,
  SORT_KEYS,
  TYPE_FILTERS,
  getProvider,
  type ContextFilter,
  type SortKey,
  type TypeFilter,
} from '@/lib/catalog';
import {
  filterSiteModels,
  providersOf,
  siteFacetCounts,
  type SiteCatalog,
  type SiteModel,
} from '@/lib/catalog/live';
import { useEdition } from '@/lib/use-catalog-state';
import { useUrlList, useUrlState, useUrlText } from '@/lib/use-url-state';
import { cn } from '@/lib/utils';

/** ≥ 200K / ≥ 1M 是固定写法，不进消息文件；分段与筛选栏的数量全部来自 facetCounts，不写死 */

/** 上下文胶囊：选中态与未选中态都是完整类名，按状态映射，不拼接 */
const CONTEXT_PILL = {
  on: 'rounded-full border px-3 py-1 text-xs font-medium transition-colors border-primary bg-primary text-primary-foreground',
  off: 'rounded-full border px-3 py-1 text-xs font-medium transition-colors border-border bg-card text-muted-foreground hover:text-foreground',
} as const;

/** 筛选面板显隐：手机默认收起、由工具条按钮切换；lg 起始终显示。完整类名映射，不拼接 */
const FILTER_PANEL = {
  open: 'block',
  closed: 'hidden lg:block',
} as const;

/** 筛选开关按钮：只在小屏出现 */
const FILTER_TOGGLE = 'lg:hidden';

const SORT_LABEL_KEYS: Record<SortKey, 'latest' | 'price-asc' | 'price-desc' | 'context'> = {
  latest: 'latest',
  'price-asc': 'price-asc',
  'price-desc': 'price-desc',
  context: 'context',
};

const NO_MODELS: readonly SiteModel[] = [];

export function ModelsExplorer({ catalog }: { catalog: SiteCatalog }) {
  const t = useTranslations('models');
  const locale = useLocale();

  const [edition] = useEdition();
  // 企业通道没有公开单价，借专用通道的模型列表
  const available = edition === 'enterprise' ? (catalog.pro ?? catalog.personal) : catalog[edition];
  const models = available ?? NO_MODELS;
  const [type, setType] = useUrlState('type', TYPE_FILTERS, 'all');
  const [providers, setProviders] = useUrlList(
    'provider',
    PROVIDERS.map((p) => p.id),
  );
  const [context, setContext] = useUrlState('context', CONTEXT_FILTERS, 'all');
  const [sort, setSort] = useUrlState('sort', SORT_KEYS, 'latest');
  const [query, setQuery] = useUrlText('q');

  // 手机（lg 以下）筛选面板默认收起
  const [filtersOpen, setFiltersOpen] = useState(false);

  // 搜索框本地受控，输入即写网址；网址里的 q 变化（如点清除筛选）时，在渲染中直接同步回本地
  // （React 推荐的「随外部值调整状态」写法，避免在副作用里 setState 引起连锁渲染）
  const [search, setSearch] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setSearch(query);
  }

  const counts = siteFacetCounts(models, type);
  const list = filterSiteModels(models, { type, providers, context, query, sort });
  const providerOptions = providersOf(models);

  const hasFilters = providers.length > 0 || context !== 'all' || query.trim() !== '';

  /** 清除筛选：清空厂商、搜索，上下文回 all；类型、排序、通道不动 */
  const clearFilters = () => {
    setProviders([]);
    setContext('all');
    setQuery('');
  };

  /** 空状态里的清除：在清除筛选的基础上把类型也重置为 all */
  const clearAll = () => {
    clearFilters();
    setType('all');
  };

  /** 多选切换：再点一次取消 */
  const toggleProvider = (id: (typeof providers)[number]) => {
    setProviders(providers.includes(id) ? providers.filter((p) => p !== id) : [...providers, id]);
  };

  const contextOptions = [
    { value: 'all' as ContextFilter, label: t('filters.contextAll') },
    { value: '200k' as ContextFilter, label: '≥ 200K' },
    { value: '1m' as ContextFilter, label: '≥ 1M' },
  ];

  const sortLabels: Record<SortKey, string> = {
    latest: t('sort.latest'),
    'price-asc': t('sort.price-asc'),
    'price-desc': t('sort.price-desc'),
    context: t('sort.context'),
  };

  const filters = (
    <>
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-subtle-foreground">
          {t('filters.context')}
        </p>
        <div className="flex flex-wrap gap-2">
          {contextOptions.map((option) => {
            const selected = context === option.value;
            return (
              <button
                key={option.value}
                type="button"
                data-context={option.value}
                aria-pressed={selected}
                onClick={() => setContext(option.value)}
                className={selected ? CONTEXT_PILL.on : CONTEXT_PILL.off}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-subtle-foreground">
          {t('filters.providers')}
        </p>
        <div className="space-y-0.5">
          {providerOptions.map((id) => {
            const checked = providers.includes(id);
            const count = counts.providers[id] ?? 0;
            return (
              <label
                key={id}
                data-provider={id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted',
                  count === 0 && 'opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--foreground)]"
                  checked={checked}
                  onChange={() => toggleProvider(id)}
                />
                <ProviderLogo provider={id} size={16} />
                <span className="flex-1 truncate">{getProvider(id).name}</span>
                <span className="text-xs tabular-nums text-subtle-foreground">{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      {hasFilters ? (
        <button
          type="button"
          data-clear-filters
          onClick={clearFilters}
          className={buttonClass({
            variant: 'link',
            size: 'sm',
            className: 'text-muted-foreground',
          })}
        >
          {t('filters.clear')}
        </button>
      ) : null}
    </>
  );

  if (available === null) {
    return (
      <section id="explorer" className="pb-20 md:pb-28">
        <Container>
          <div
            data-models-unavailable
            className="rounded-2xl border border-dashed border-border-strong px-6 py-20 text-center text-base text-muted-foreground"
          >
            {t('empty.unavailable')}
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section id="explorer" className="pb-20 md:pb-28">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside data-filters className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            <div className={cn(FILTER_PANEL[filtersOpen ? 'open' : 'closed'], 'space-y-8')}>
              {filters}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  data-filter-toggle
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((open) => !open)}
                  className={cn(FILTER_TOGGLE, buttonClass({ variant: 'secondary', size: 'sm' }))}
                >
                  <SlidersHorizontal aria-hidden />
                  {t('filters.toggle')}
                </button>
                <p className="text-sm text-muted-foreground">
                  <span data-result-count className="font-semibold tabular-nums text-foreground">
                    {list.length}
                  </span>{' '}
                  {t('toolbar.models')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-72">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
                  />
                  <Input
                    data-model-search
                    type="search"
                    className="pl-9"
                    placeholder={t('toolbar.search')}
                    aria-label={t('toolbar.search')}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setQuery(event.target.value);
                    }}
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-sort-trigger
                    aria-label={t('sort.label')}
                    className={buttonClass({ variant: 'secondary', size: 'md' })}
                  >
                    <ArrowUpDown aria-hidden />
                    {sortLabels[sort]}
                    <ChevronDown aria-hidden className="size-3.5!" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={sort}
                      onValueChange={(value) => setSort(value as SortKey)}
                    >
                      {SORT_KEYS.map((key) => (
                        <DropdownMenuRadioItem key={key} value={key} data-sort={key}>
                          {sortLabels[SORT_LABEL_KEYS[key]]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <SegmentedControl
              name="type"
              value={type}
              onChange={setType}
              ariaLabel={t('types.label')}
              options={[
                { value: 'all' as TypeFilter, label: t('types.all'), count: counts.types.all },
                { value: 'text' as TypeFilter, label: t('types.text'), count: counts.types.text },
                {
                  value: 'image' as TypeFilter,
                  label: t('types.image'),
                  count: counts.types.image,
                },
              ]}
            />

            {list.length === 0 ? (
              <div
                data-empty-state
                className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-20 text-center"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Search aria-hidden className="size-5 text-muted-foreground" />
                </span>
                <p className="mt-4 text-base font-medium text-foreground">{t('empty.title')}</p>
                <button
                  type="button"
                  data-empty-clear
                  onClick={clearAll}
                  className={cn('mt-6', buttonClass({ variant: 'secondary' }))}
                >
                  {t('filters.clear')}
                </button>
              </div>
            ) : (
              <div data-model-grid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((model) => (
                  <ModelsExplorerCard
                    key={model.id}
                    model={model}
                    edition={edition}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

export default ModelsExplorer;
