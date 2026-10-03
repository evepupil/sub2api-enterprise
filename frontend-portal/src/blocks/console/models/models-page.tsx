'use client';

import { Layers, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/console/button';
import { ConsolePage } from '@/components/console/console-page';
import { EmptyState } from '@/components/console/empty-state';
import { Skeleton } from '@/components/console/skeleton';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useConsoleModels } from '@/lib/console/live/models-client';
import { useFavoriteModels } from '@/lib/console/live/models-favorites';
import {
  allModelRows,
  filterRows,
  providersIn,
  type LiveCurrency,
} from '@/lib/console/live/models-view';

import { ModelsFilterBar } from './models-filter-bar';
import {
  DEFAULT_QUERY,
  clearFilters,
  paginationKey,
  type ModelScope,
  type ModelsQuery,
} from './models-state';
import { ModelsTable } from './models-table';
import { ModelsToolbar } from './models-toolbar';

/**
 * 控制台「模型」页（接后端）：账号能用的所有分组的模型摊在一张表里，每行写着分组名与倍率，
 * 实付价按各自分组的倍率算（都来自后端模型广场）；展示名、厂商、协议、上下文来自官网目录。
 * 可以按类型、厂商、上下文、协议、关键词（含分组名）筛选，换币种看价格，收藏常用模型（存在这台浏览器里），
 * 文本模型一键带着模型名去对话页试用。
 */
export function ConsoleModelsPage() {
  const t = useTranslations('consoleModels');
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useConsoleModels(reloadKey);
  const [favorites, toggleFavorite] = useFavoriteModels();

  const [scope, setScope] = useState<ModelScope>('all');
  const [query, setQuery] = useState<ModelsQuery>(DEFAULT_QUERY);
  const [currency, setCurrency] = useState<LiveCurrency>('usd');

  const allRows = useMemo(() => allModelRows(data?.channels ?? []), [data]);
  const providers = useMemo(() => providersIn(allRows), [allRows]);
  const filtered = useMemo(() => filterRows(allRows, query), [allRows, query]);
  const rows =
    scope === 'favorites' ? filtered.filter((row) => favorites.includes(row.id)) : filtered;
  const favoriteCount = allRows.filter((row) => favorites.includes(row.id)).length;

  const patchQuery = (change: Partial<ModelsQuery>) =>
    setQuery((current) => ({ ...current, ...change }));

  let body: React.ReactNode;
  if (error && !data) {
    body = (
      <EmptyState
        id="models-error"
        icon={TriangleAlert}
        title={error === 'too_many' ? t('error.tooMany') : t('error.unavailable')}
        action={
          <Button
            variant="secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            data-models-retry
          >
            {t('error.retry')}
          </Button>
        }
      />
    );
  } else if (loading && !data) {
    body = (
      <div data-models-loading className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  } else if (!data || allRows.length === 0) {
    body = <EmptyState id="models-none" icon={Layers} title={t('noModels')} />;
  } else {
    body = (
      <>
        <div className="space-y-4">
          <SegmentedControl
            name="model-scope"
            value={scope}
            onChange={setScope}
            ariaLabel={t('scope.label')}
            options={[
              { value: 'all', label: t('scope.all'), count: allRows.length },
              { value: 'favorites', label: t('scope.favorites'), count: favoriteCount },
            ]}
          />
          <ModelsFilterBar query={query} providers={providers} onChange={patchQuery} />
          <ModelsToolbar
            sort={query.sort}
            onSortChange={(sort) => patchQuery({ sort })}
            currency={currency}
            onCurrencyChange={setCurrency}
            rechargeMultiplier={data.rechargeMultiplier}
          />
        </div>

        <ModelsTable
          rows={rows}
          resetKey={paginationKey(scope, query)}
          currency={currency}
          rechargeMultiplier={data.rechargeMultiplier}
          favorites={favorites}
          noFavorites={scope === 'favorites' && favoriteCount === 0}
          onToggleFavorite={toggleFavorite}
          onClearFilters={() => setQuery(clearFilters)}
        />
      </>
    );
  }

  return (
    <ConsolePage id="models" title={t('meta.title')}>
      {body}
    </ConsolePage>
  );
}
