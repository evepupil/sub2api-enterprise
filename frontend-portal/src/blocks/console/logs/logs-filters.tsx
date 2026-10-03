'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DateRangePicker } from '@/components/console/date-range-picker';
import { FilterField, SearchInput } from '@/components/console/filter-field';
import { Panel } from '@/components/console/panel';
import { Select, type SelectOption } from '@/components/console/select';
import { Button } from '@/components/ui/button';
import { getModel } from '@/lib/catalog';
import {
  API_KEYS,
  logsToCsv,
  TODAY,
  USED_MODEL_IDS,
  type LogFilter,
  type RequestLog,
} from '@/lib/console';

import { downloadCsv } from './logs-export';

/**
 * 日志筛选栏：第一行是六个条件（时间、密钥、模型、状态、类型、流式），
 * 第二行是请求 ID 搜索、清除筛选和导出。任何条件变化都由上层重新算结果并回到第 1 页。
 * rows 是当前筛选结果（全部，不只当前页），导出 CSV 用它。
 */
export function LogsFilters({
  filter,
  onChange,
  rows,
  dirty,
  onClear,
}: {
  filter: LogFilter;
  onChange: (filter: LogFilter) => void;
  rows: readonly RequestLog[];
  /** 筛选条件是否已经偏离默认值，决定要不要显示「清除筛选」 */
  dirty: boolean;
  onClear: () => void;
}) {
  const t = useTranslations('consoleLogs');
  const all = t('filters.all');

  const keyOptions: SelectOption<string>[] = [
    { value: 'all', label: all },
    ...API_KEYS.map((key) => ({ value: key.id, label: key.name })),
  ];
  const modelOptions: SelectOption<string>[] = [
    { value: 'all', label: all },
    ...USED_MODEL_IDS.map((id) => ({ value: id, label: getModel(id).name })),
  ];
  const statusOptions: SelectOption<LogFilter['status']>[] = [
    { value: 'all', label: all },
    { value: 'success', label: t('filters.success') },
    { value: 'error', label: t('filters.error') },
  ];
  const typeOptions: SelectOption<LogFilter['type']>[] = [
    { value: 'all', label: all },
    { value: 'text', label: t('filters.text') },
    { value: 'image', label: t('filters.image') },
  ];
  const streamOptions: SelectOption<LogFilter['stream']>[] = [
    { value: 'all', label: all },
    { value: 'stream', label: t('filters.streamOn') },
    { value: 'non-stream', label: t('filters.streamOff') },
  ];

  return (
    <Panel id="log-filters">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterField label={t('filters.time')}>
          <DateRangePicker
            align="start"
            className="w-full"
            value={filter.range}
            onChange={(range) => onChange({ ...filter, range })}
          />
        </FilterField>
        <FilterField label={t('filters.key')}>
          <Select
            name="log-key"
            value={filter.keyId}
            onChange={(keyId) => onChange({ ...filter, keyId })}
            options={keyOptions}
            ariaLabel={t('filters.key')}
          />
        </FilterField>
        <FilterField label={t('filters.model')}>
          <Select
            name="log-model"
            value={filter.modelId}
            onChange={(modelId) => onChange({ ...filter, modelId })}
            options={modelOptions}
            ariaLabel={t('filters.model')}
          />
        </FilterField>
        <FilterField label={t('filters.status')}>
          <Select
            name="log-status"
            value={filter.status}
            onChange={(status) => onChange({ ...filter, status })}
            options={statusOptions}
            ariaLabel={t('filters.status')}
          />
        </FilterField>
        <FilterField label={t('filters.type')}>
          <Select
            name="log-type"
            value={filter.type}
            onChange={(type) => onChange({ ...filter, type })}
            options={typeOptions}
            ariaLabel={t('filters.type')}
          />
        </FilterField>
        <FilterField label={t('filters.stream')}>
          <Select
            name="log-stream"
            value={filter.stream}
            onChange={(stream) => onChange({ ...filter, stream })}
            options={streamOptions}
            ariaLabel={t('filters.stream')}
          />
        </FilterField>
      </div>

      {/* 按钮和搜索框都是 h-10，底部对齐 */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <FilterField label={t('filters.requestId')} htmlFor="log-search" className="min-w-0 flex-1">
          <SearchInput
            id="log-search"
            data-log-search
            placeholder={t('filters.search')}
            value={filter.query}
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
          />
        </FilterField>
        {dirty ? (
          <Button variant="ghost" className="h-10" data-clear-filters onClick={onClear}>
            {t('filters.clear')}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="h-10"
          data-export
          disabled={rows.length === 0}
          onClick={() => downloadCsv(logsToCsv(rows), `logs-${TODAY}.csv`)}
        >
          <Download aria-hidden />
          {t('export')}
        </Button>
      </div>
    </Panel>
  );
}
