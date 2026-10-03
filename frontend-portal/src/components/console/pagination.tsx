'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  DEFAULT_PAGE_SIZE,
  pageButtons,
  paginate,
  PAGE_SIZES,
  type Page,
} from '@/lib/console/pagination';
import { cn } from '@/lib/utils';

import { Select } from './select';

const PAGE_BUTTON =
  'inline-flex size-8 items-center justify-center rounded-md border text-sm tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40';

/**
 * 分页条：左「共 N 条」，右上一页、页码（中间省略）、下一页、每页条数。
 * 交互检查：外层 data-pagination，总数 data-total，页码 data-page={n}。
 */
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const t = useTranslations('console');
  return (
    <div data-pagination className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span data-total className="text-muted-foreground">
        {t('table.total', { total })}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label={t('table.prev')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(PAGE_BUTTON, 'border-border text-muted-foreground hover:bg-muted')}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        {pageButtons(page, pages).map((button, index) =>
          button === 'gap' ? (
            <span key={`gap-${index}`} aria-hidden className="px-1 text-subtle-foreground">
              …
            </span>
          ) : (
            <button
              key={button}
              type="button"
              data-page={button}
              aria-current={button === page ? 'page' : undefined}
              aria-label={t('table.page', { page: button })}
              onClick={() => onPageChange(button)}
              className={cn(
                PAGE_BUTTON,
                button === page
                  ? 'border-foreground font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
            >
              {button}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label={t('table.next')}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={cn(PAGE_BUTTON, 'border-border text-muted-foreground hover:bg-muted')}
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
        <Select
          name="page-size"
          size="sm"
          align="end"
          value={String(pageSize)}
          onChange={(value) => onPageSizeChange(Number(value))}
          ariaLabel={t('table.pageSize')}
          options={PAGE_SIZES.map((size) => ({
            value: String(size),
            label: t('table.perPage', { size }),
          }))}
          className="ml-1 w-28"
        />
      </div>
    </div>
  );
}

/**
 * 表格分页状态：resetKey（通常是筛选条件拼成的字符串）变化时回到第 1 页。
 * 用「渲染时按外部值调整状态」的写法，不在副作用里改状态。
 */
export function usePagination<T>(items: readonly T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPage(1);
  }
  const current: Page<T> = paginate(items, page, pageSize);
  return {
    ...current,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
  };
}
