'use client';

import { ChevronLeft, ChevronRight, Receipt, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/console/button';
import { Table, Td, Th, Tr } from '@/components/console/data-table';
import { DateRangePicker } from '@/components/console/date-range-picker';
import { EmptyState } from '@/components/console/empty-state';
import { FilterField, SearchInput } from '@/components/console/filter-field';
import { Pagination } from '@/components/console/pagination';
import { Panel } from '@/components/console/panel';
import { Select } from '@/components/console/select';
import { Skeleton } from '@/components/console/skeleton';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import {
  formatDateTimeShort,
  formatMonthTitle,
  formatSignedUsd,
  formatUsd,
  PAGE_SIZES,
  presetRange,
  type DateRange,
} from '@/lib/console';
import {
  isKnownLedgerSource,
  LEDGER_TYPES,
  type LedgerEntry,
  type LedgerQuery,
  type LedgerType,
} from '@/lib/console/live/billing-types';
import {
  amountRange,
  isCurrentOrLaterMonth,
  monthRangeOf,
  shiftYearMonth,
  yearMonthOf,
} from '@/lib/console/live/billing-view';
import { useBalanceLedger } from '@/lib/console/live/use-billing';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

import { AmountInput } from './billing-amount-input';

/** 类型徽标的颜色：充值蓝，兑换码、优惠码、邀请返利绿，管理员调整灰，退款黄 */
const TYPE_TONES: Record<LedgerType, BadgeTone> = {
  recharge: 'info',
  redeem: 'success',
  promo: 'success',
  affiliate: 'success',
  admin: 'neutral',
  refund: 'warning',
};

const TYPE_OPTIONS: readonly (LedgerType | 'all')[] = ['all', ...LEDGER_TYPES];
/** 来源是支付方式的类型：类型列旁边写上用什么付的 */
const PAYMENT_TYPES: ReadonlySet<LedgerType> = new Set(['recharge', 'refund']);
const DEFAULT_PAGE_SIZE = PAGE_SIZES[1] ?? 20;
/** 搜索框、金额框停下来多久才去查（每次查询都会问后端） */
const INPUT_DEBOUNCE_MS = 400;

/** 筛选条件。range 为 null 表示默认的「最近 30 天」（跟着今天走）；金额保留输入框里的原始文字 */
interface FilterState {
  range: DateRange | null;
  type: LedgerType | 'all';
  source: string;
  min: string;
  max: string;
  query: string;
}

const DEFAULT_FILTER: FilterState = {
  range: null,
  type: 'all',
  source: 'all',
  min: '',
  max: '',
  query: '',
};

/**
 * 交易记录（接后端）：只列账户余额的变动——充值、兑换码、优惠码、邀请返利转入、管理员调整、退款，
 * 不含每次调用的扣费。标题行可按月翻、也可选时间范围；筛选类型、来源、订单号或兑换码、金额范围；
 * 分页在后端做。today、since 为 null 时还不知道今天是哪天，先不取。reloadKey 变了（兑换成功）就重新取。
 */
export function BillingTransactions({
  today,
  since,
  reloadKey,
}: {
  today: string | null;
  since: string | null;
  reloadKey: number;
}) {
  const t = useTranslations('consoleBilling');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [retryKey, setRetryKey] = useState(0);

  /** 改任何筛选条件都回到第 1 页 */
  const patch = (change: Partial<FilterState>) => {
    setFilter((current) => ({ ...current, ...change }));
    setPage(1);
  };

  // 预设范围跟着「今天」走（跨天自动更新），自定义范围与按月翻出来的范围原样保留
  const range = useMemo<DateRange | null>(() => {
    if (today === null || since === null) return null;
    if (filter.range === null) return presetRange('last30d', today, since);
    return filter.range.preset ? presetRange(filter.range.preset, today, since) : filter.range;
  }, [filter.range, today, since]);

  const search = useDebouncedValue(filter.query.trim(), INPUT_DEBOUNCE_MS);
  const amountText = useDebouncedValue(`${filter.min}|${filter.max}`, INPUT_DEBOUNCE_MS);

  const query = useMemo<LedgerQuery | null>(() => {
    if (range === null) return null;
    const [minText = '', maxText = ''] = amountText.split('|');
    const { min, max } = amountRange(minText, maxText);
    return {
      page,
      pageSize,
      type: filter.type === 'all' ? null : filter.type,
      source: filter.source === 'all' ? null : filter.source,
      query: search,
      minUsd: min,
      maxUsd: max,
      from: range.from,
      to: range.to,
    };
  }, [range, page, pageSize, filter.type, filter.source, search, amountText]);

  const ledger = useBalanceLedger(query, reloadKey + retryKey);
  const data = ledger.data;

  // 按月翻：显示范围起点所在的月；往后不能翻过本月，往前不能早于开户那个月
  const shownMonth = range === null ? null : yearMonthOf(range.from);
  const firstMonth = since === null ? null : yearMonthOf(since);
  const canGoBack =
    shownMonth !== null &&
    firstMonth !== null &&
    shownMonth.year * 12 + shownMonth.month > firstMonth.year * 12 + firstMonth.month;
  const canGoForward =
    shownMonth !== null && today !== null && !isCurrentOrLaterMonth(shownMonth, today);
  const goMonth = (delta: number) => {
    if (shownMonth === null || today === null) return;
    patch({ range: monthRangeOf(shiftYearMonth(shownMonth, delta), today) });
  };

  // 来源下拉：这个账号流水里出现过的全部来源；选中的那个即使这次没返回也留在列表里
  const sources = data?.sources ?? [];
  const sourceOptions = [
    'all',
    ...sources,
    ...(filter.source !== 'all' && !sources.includes(filter.source) ? [filter.source] : []),
  ];
  const sourceLabel = (source: string) =>
    isKnownLedgerSource(source) ? t(`sources.${source}`) : source;

  const filtered =
    filter.range !== null ||
    filter.type !== 'all' ||
    filter.source !== 'all' ||
    filter.min !== '' ||
    filter.max !== '' ||
    filter.query.trim() !== '';
  const stale = data !== null && ledger.loading;

  /** 说明一列：充值、退款写订单号，兑换码、优惠码写码，管理员调整写备注 */
  const noteFor = (entry: LedgerEntry): string => {
    switch (entry.type) {
      case 'recharge':
        return t('txn.notes.order', { ref: entry.reference });
      case 'redeem':
        return t('txn.notes.code', { ref: entry.reference });
      case 'promo':
        return t('txn.notes.promo', { ref: entry.reference });
      case 'affiliate':
        return t('txn.notes.affiliate');
      case 'admin':
        return entry.note !== '' ? entry.note : t('txn.notes.admin');
      case 'refund': {
        const base = t('txn.notes.refund', { ref: entry.reference });
        return entry.note !== '' ? `${base} · ${entry.note}` : base;
      }
    }
  };

  return (
    <Panel
      id="transactions"
      title={t('txn.title')}
      actions={
        <>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="size-8 px-0"
              aria-label={t('txn.prevMonth')}
              data-month-prev
              disabled={!canGoBack}
              onClick={() => goMonth(-1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span data-month className="min-w-24 text-center text-sm tabular-nums text-foreground">
              {shownMonth ? formatMonthTitle(shownMonth.year, shownMonth.month, locale) : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 px-0"
              aria-label={t('txn.nextMonth')}
              data-month-next
              disabled={!canGoForward}
              onClick={() => goMonth(1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          {/* 还不知道今天是哪天时（刚打开的一瞬间）先按默认范围显示按钮、按钮不可点，避免标题行跳动 */}
          <DateRangePicker
            value={range ?? presetRange('last30d')}
            onChange={(next) => patch({ range: next })}
            today={today}
            since={since}
            align="end"
          />
        </>
      }
      bodyClassName="p-0"
    >
      {/* 面板标题行下面没有内边距，筛选行自己留出上边距 */}
      <div className="grid gap-3 border-b border-border px-5 pb-5 pt-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.4fr)]">
        <FilterField label={t('txn.type')}>
          <Select
            name="txn-type"
            value={filter.type}
            onChange={(type) => patch({ type })}
            ariaLabel={t('txn.type')}
            options={TYPE_OPTIONS.map((value) => ({ value, label: t(`types.${value}`) }))}
          />
        </FilterField>
        <FilterField label={t('txn.source')}>
          <Select
            name="txn-source"
            value={filter.source}
            onChange={(source) => patch({ source })}
            ariaLabel={t('txn.source')}
            options={sourceOptions.map((value) => ({
              value,
              label: value === 'all' ? t('sources.all') : sourceLabel(value),
            }))}
          />
        </FilterField>
        <FilterField label={t('txn.search')} htmlFor="txn-search">
          <SearchInput
            id="txn-search"
            data-txn-search
            value={filter.query}
            onChange={(event) => patch({ query: event.target.value })}
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
      </div>

      {/* data-table 放在表格和分页的共同外层上，交互检查在里面找「共 N 条」 */}
      <div
        data-table="transactions"
        aria-busy={ledger.loading ? 'true' : undefined}
        className={cn('transition-opacity', stale && 'opacity-60')}
      >
        {ledger.error ? (
          <EmptyState
            id="transactions-error"
            icon={TriangleAlert}
            title={ledger.error === 'too_many' ? t('errors.tooMany') : t('errors.unavailable')}
            bordered={false}
            action={
              <Button variant="secondary" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
                {t('errors.retry')}
              </Button>
            }
          />
        ) : data === null ? (
          <div className="space-y-3 px-5 py-5">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            id="transactions"
            icon={Receipt}
            title={filtered ? t('empty.filtered') : t('empty.none')}
            bordered={false}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter(DEFAULT_FILTER);
                    setPage(1);
                  }}
                >
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
                  {data.items.map((entry) => {
                    const note = noteFor(entry);
                    return (
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
                            {/* 只有充值、退款的来源（支付方式）多带信息；其余类型的来源和类型同名，不重复写 */}
                            {PAYMENT_TYPES.has(entry.type) && entry.source !== '' ? (
                              <span className="text-xs text-subtle-foreground">
                                {sourceLabel(entry.source)}
                              </span>
                            ) : null}
                          </div>
                        </Td>
                        <Td>
                          {/* 说明过长时截断，完整文字放在悬停提示里 */}
                          <div className="max-w-80 truncate text-muted-foreground" title={note}>
                            {note}
                          </div>
                        </Td>
                        <Td align="right" className="whitespace-nowrap pr-5 tabular-nums">
                          {formatUsd(entry.balanceAfterUsd)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            <div className="border-t border-border px-5 py-3">
              <Pagination
                page={data.page}
                pages={data.pages}
                total={data.total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
