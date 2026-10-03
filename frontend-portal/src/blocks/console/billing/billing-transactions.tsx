'use client';

import { Receipt } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Table, Td, Th, Tr } from '@/components/console/data-table';
import { DateRangePicker } from '@/components/console/date-range-picker';
import { EmptyState } from '@/components/console/empty-state';
import { FilterField, SearchInput } from '@/components/console/filter-field';
import { Pagination, usePagination } from '@/components/console/pagination';
import { Panel } from '@/components/console/panel';
import { Select } from '@/components/console/select';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AppLocale } from '@/i18n/routing';
import {
  DEFAULT_RANGE,
  filterTransactions,
  formatDateTimeShort,
  formatSignedUsd,
  formatUsd,
  TXN_TYPES,
  type DateRange,
  type LedgerEntry,
  type TxnFilter,
  type TxnType,
} from '@/lib/console';
import { cn } from '@/lib/utils';

import { AmountInput } from './billing-amount-input';
import { parseAmount } from './billing-rules';

/** 类型徽标的颜色：充值蓝、赠送与兑换绿、消费灰、退还黄 */
const TYPE_TONES: Record<TxnType, BadgeTone> = {
  recharge: 'info',
  gift: 'success',
  redeem: 'success',
  consume: 'neutral',
  refund: 'warning',
};

const TYPE_OPTIONS: readonly (TxnType | 'all')[] = ['all', ...TXN_TYPES];

/** 筛选条件。金额范围保留输入框里的原始文字，筛选时才解析成数字 */
interface FilterState {
  range: DateRange;
  type: TxnType | 'all';
  min: string;
  max: string;
  query: string;
}

const DEFAULT_FILTER: FilterState = {
  range: DEFAULT_RANGE,
  type: 'all',
  min: '',
  max: '',
  query: '',
};

/**
 * 交易记录：时间范围、类型、金额范围、流水 ID 四项筛选，结果分页显示。
 * 筛选全部走数据层的 filterTransactions，余额一列是每笔流水之后的余额。
 */
export function BillingTransactions({ ledger }: { ledger: readonly LedgerEntry[] }) {
  const t = useTranslations('consoleBilling');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const patch = (change: Partial<FilterState>) =>
    setFilter((current) => ({ ...current, ...change }));

  const txnFilter: TxnFilter = {
    range: filter.range,
    type: filter.type,
    minUsd: parseAmount(filter.min),
    maxUsd: parseAmount(filter.max),
    query: filter.query,
  };
  const rows = filterTransactions(ledger, txnFilter);
  // 任何筛选条件变了，分页回到第 1 页
  const pager = usePagination(
    rows,
    [filter.range.from, filter.range.to, filter.type, filter.min, filter.max, filter.query].join(
      '|',
    ),
  );

  const filtered =
    filter.range.from !== DEFAULT_FILTER.range.from ||
    filter.range.to !== DEFAULT_FILTER.range.to ||
    filter.type !== DEFAULT_FILTER.type ||
    filter.min !== '' ||
    filter.max !== '' ||
    filter.query.trim() !== '';

  return (
    <Panel
      id="transactions"
      title={t('txn.title')}
      actions={<DateRangePicker value={filter.range} onChange={(range) => patch({ range })} />}
      bodyClassName="p-0"
    >
      {/* 面板标题行下面没有内边距，筛选行自己留出上边距 */}
      <div className="grid gap-3 border-b border-border px-5 pb-5 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label={t('txn.type')}>
          <Select
            name="txn-type"
            value={filter.type}
            onChange={(type) => patch({ type })}
            ariaLabel={t('txn.type')}
            options={TYPE_OPTIONS.map((value) => ({ value, label: t(`types.${value}`) }))}
          />
        </FilterField>
        <FilterField label={t('txn.amount')}>
          <div role="group" aria-label={t('txn.amount')} className="flex items-center gap-2">
            <AmountInput
              id="txn-min"
              value={filter.min}
              placeholder={t('txn.min')}
              aria-label={t('txn.min')}
              onChange={(event) => patch({ min: event.target.value })}
            />
            <span aria-hidden className="text-subtle-foreground">
              –
            </span>
            <AmountInput
              id="txn-max"
              value={filter.max}
              placeholder={t('txn.max')}
              aria-label={t('txn.max')}
              onChange={(event) => patch({ max: event.target.value })}
            />
          </div>
        </FilterField>
        <FilterField label={t('txn.search')} htmlFor="txn-search">
          <SearchInput
            id="txn-search"
            placeholder="txn_…"
            value={filter.query}
            onChange={(event) => patch({ query: event.target.value })}
          />
        </FilterField>
      </div>

      {/* data-table 放在表格和分页的共同外层上，交互检查在里面找「共 N 条」 */}
      <div data-table="transactions">
        {rows.length === 0 ? (
          <EmptyState
            id="transactions"
            icon={Receipt}
            title={t('empty')}
            bordered={false}
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={() => setFilter(DEFAULT_FILTER)}>
                  {tc('actions.clearFilters')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <Table minWidth={760} aria-label={t('txn.title')}>
                <thead>
                  <tr>
                    <Th className="pl-5">{t('txn.columns.time')}</Th>
                    <Th align="right">{t('txn.columns.amount')}</Th>
                    <Th>{t('txn.columns.type')}</Th>
                    <Th>{t('txn.columns.note')}</Th>
                    <Th align="right" className="pr-5">
                      {t('txn.columns.balance')}
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {pager.items.map((entry) => (
                    <Tr key={entry.id} data-txn-row={entry.id}>
                      <Td className="whitespace-nowrap pl-5 tabular-nums text-muted-foreground">
                        {formatDateTimeShort(entry.ts)}
                      </Td>
                      <Td
                        align="right"
                        className={cn(
                          'whitespace-nowrap font-medium tabular-nums',
                          entry.amountUsd > 0 ? 'text-success' : 'text-foreground',
                        )}
                      >
                        {formatSignedUsd(entry.amountUsd)}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Badge tone={TYPE_TONES[entry.type]} className="self-center">
                            {t(`types.${entry.type}`)}
                          </Badge>
                          {entry.method ? (
                            <span className="text-xs text-subtle-foreground">
                              {t(`methods.${entry.method}`)}
                            </span>
                          ) : null}
                        </div>
                      </Td>
                      <Td>
                        {/* 说明过长时截断，完整文字放在悬停提示里 */}
                        <div
                          className="max-w-80 truncate text-muted-foreground"
                          title={entry.note[locale]}
                        >
                          {entry.note[locale]}
                        </div>
                      </Td>
                      <Td align="right" className="whitespace-nowrap pr-5 tabular-nums">
                        {formatUsd(entry.balanceUsd)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="border-t border-border px-5 py-3">
              <Pagination
                page={pager.page}
                pages={pager.pages}
                total={pager.total}
                pageSize={pager.pageSize}
                onPageChange={pager.setPage}
                onPageSizeChange={pager.setPageSize}
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
