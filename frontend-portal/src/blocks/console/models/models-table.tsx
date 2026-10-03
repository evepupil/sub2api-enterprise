'use client';

import { Layers } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/console/empty-state';
import { Table, TableShell, Th } from '@/components/console/data-table';
import { Pagination, usePagination } from '@/components/console/pagination';
import { Button } from '@/components/ui/button';
import type { AppLocale } from '@/i18n/routing';
import type { Currency, EditionId, Model } from '@/lib/catalog';

import { ModelRow } from './models-row';

/**
 * 模型表：宽表在小屏横向滚动，带分页；没有结果时表头下方显示空状态。
 * 分页状态放在这里，resetKey 变了（筛选条件变了）自动回第 1 页。
 */
export function ModelsTable({
  rows,
  resetKey,
  group,
  currency,
  favorites,
  noFavorites,
  onToggleFavorite,
  onClearFilters,
}: {
  /** 筛选、排序、范围都处理完的全部结果，分页在表内做 */
  rows: readonly Model[];
  resetKey: string;
  group: EditionId;
  currency: Currency;
  favorites: readonly string[];
  /** 收藏范围下一个模型都没收藏：空状态换成「还没有收藏的模型」，不给清除筛选 */
  noFavorites: boolean;
  onToggleFavorite: (id: string) => void;
  onClearFilters: () => void;
}) {
  const t = useTranslations('consoleModels');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const pager = usePagination(rows, resetKey);

  return (
    <TableShell
      id="console-models"
      footer={
        <Pagination
          page={pager.page}
          pages={pager.pages}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      }
    >
      {/* 八列的宽表：单元格左右内边距收到 12px，英文文案较长也能在 1440 桌面宽度下放下，不用横向滚动 */}
      <Table minWidth={1080} className="[&_td]:px-3 [&_th]:px-3">
        <thead>
          <tr>
            <Th sticky="left" className="min-w-60 max-sm:static">
              {t('table.model')}
            </Th>
            <Th align="right">{t('table.price')}</Th>
            <Th>{t('table.discount')}</Th>
            <Th>{t('table.type')}</Th>
            <Th>{t('table.provider')}</Th>
            <Th>{t('table.protocols')}</Th>
            <Th>{t('table.context')}</Th>
            <Th sticky="right">{tc('table.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {pager.items.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              group={group}
              currency={currency}
              locale={locale}
              favorite={favorites.includes(model.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </tbody>
      </Table>
      {rows.length === 0 ? (
        <EmptyState
          id="console-models"
          icon={Layers}
          title={noFavorites ? t('emptyFavorites') : t('empty')}
          bordered={false}
          action={
            noFavorites ? undefined : (
              <Button variant="secondary" size="sm" onClick={onClearFilters}>
                {t('filters.clear')}
              </Button>
            )
          }
        />
      ) : null}
    </TableShell>
  );
}
