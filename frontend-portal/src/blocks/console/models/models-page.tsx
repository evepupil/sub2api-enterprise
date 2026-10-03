'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { ConsolePage } from '@/components/console/console-page';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { MODELS, filterModels, type Currency, type EditionId } from '@/lib/catalog';
import { CURRENT_USER } from '@/lib/console';

import { ModelsFilterBar } from './models-filter-bar';
import {
  DEFAULT_FAVORITES,
  DEFAULT_QUERY,
  clearFilters,
  paginationKey,
  toModelFilter,
  type ModelScope,
  type ModelsQuery,
} from './models-state';
import { ModelsTable } from './models-table';
import { ModelsToolbar } from './models-toolbar';

/**
 * 控制台「模型」页：可以按类型、厂商、上下文、协议、关键词筛选，换通道和币种看价格，
 * 收藏常用模型，文本模型一键带着模型名去对话页试用。全部状态只存在本页，不发请求。
 */
export function ConsoleModelsPage() {
  const t = useTranslations('consoleModels');

  const [scope, setScope] = useState<ModelScope>('all');
  const [favorites, setFavorites] = useState<readonly string[]>(DEFAULT_FAVORITES);
  const [query, setQuery] = useState<ModelsQuery>(DEFAULT_QUERY);
  // 价格按哪个通道算，默认是当前账号的默认通道
  const [group, setGroup] = useState<EditionId>(CURRENT_USER.defaultGroup);
  const [currency, setCurrency] = useState<Currency>('usd');

  const patchQuery = (change: Partial<ModelsQuery>) =>
    setQuery((current) => ({ ...current, ...change }));

  const toggleFavorite = (id: string) =>
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  // 筛选和排序交给数据层；价格排序要知道通道，所以把通道一并传进去
  const filtered = filterModels(MODELS, toModelFilter(query), group);
  const rows = scope === 'favorites' ? filtered.filter((m) => favorites.includes(m.id)) : filtered;

  return (
    <ConsolePage id="models" title={t('meta.title')}>
      <div className="space-y-4">
        <SegmentedControl
          name="model-scope"
          value={scope}
          onChange={setScope}
          ariaLabel={t('scope.label')}
          options={[
            { value: 'all', label: t('scope.all'), count: MODELS.length },
            { value: 'favorites', label: t('scope.favorites'), count: favorites.length },
          ]}
        />
        <ModelsFilterBar query={query} onChange={patchQuery} />
        <ModelsToolbar
          sort={query.sort}
          onSortChange={(sort) => patchQuery({ sort })}
          group={group}
          onGroupChange={setGroup}
          currency={currency}
          onCurrencyChange={setCurrency}
        />
      </div>

      <ModelsTable
        rows={rows}
        resetKey={paginationKey(scope, query)}
        group={group}
        currency={currency}
        favorites={favorites}
        noFavorites={scope === 'favorites' && favorites.length === 0}
        onToggleFavorite={toggleFavorite}
        onClearFilters={() => setQuery(clearFilters)}
      />
    </ConsolePage>
  );
}
