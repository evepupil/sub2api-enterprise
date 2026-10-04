'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { ColumnPicker, type ColumnOption } from '@/components/console/column-picker';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { DateRangePicker } from '@/components/console/date-range-picker';
import { FilterField } from '@/components/console/filter-field';
import { Panel } from '@/components/console/panel';
import { Select, type SelectOption } from '@/components/console/select';
import type { DateRange } from '@/lib/console';
import type { LogOptions, LogStream, LogType } from '@/lib/console/live/logs-types';

import { DEFAULT_LOG_COLUMNS, LOG_COLUMNS, type LogColumn } from './logs-columns';
import type { LogSelection } from './logs-types';

/** 下拉里「全部」用的值（真实的密钥 ID、模型名不会是它） */
const ALL = 'all';

/**
 * 日志筛选栏：时间、密钥、模型、类型、流式五个条件，右下是清除筛选、列设置和导出 CSV。
 * 密钥、模型的选项来自后端（账号的密钥、这段时间用过的模型）；任何条件变化都由上层重新取数并回到第 1 页。
 */
export function LogsFilters({
  selection,
  range,
  today,
  since,
  options,
  onChange,
  dirty,
  onClear,
  exporting,
  exportFailed,
  canExport,
  onExport,
  columns,
  onSaveColumns,
}: {
  selection: LogSelection;
  /** 当前生效的时间范围（selection.range 为空时是默认的最近 30 天） */
  range: DateRange;
  today: string | undefined;
  since: string | undefined;
  options: LogOptions | null;
  onChange: (change: Partial<LogSelection>) => void;
  /** 筛选条件是否已经偏离默认值，决定要不要显示「清除筛选」 */
  dirty: boolean;
  onClear: () => void;
  exporting: boolean;
  exportFailed: boolean;
  canExport: boolean;
  onExport: () => void;
  /** 表格现在显示的列；在「列设置」里保存后通过 onSaveColumns 交回 */
  columns: readonly LogColumn[];
  onSaveColumns: (columns: LogColumn[]) => void;
}) {
  const t = useTranslations('consoleLogs');
  const all = t('filters.all');

  // 选中的密钥或模型不在选项里（比如换了时间范围）也照样显示出来，不让下拉变空
  const keys = options?.keys ?? [];
  const keyOptions: SelectOption<string>[] = [
    { value: ALL, label: all },
    ...keys.map((key) => ({ value: String(key.id), label: key.name })),
    ...(selection.keyId !== null && !keys.some((key) => key.id === selection.keyId)
      ? [{ value: String(selection.keyId), label: `#${selection.keyId}` }]
      : []),
  ];
  const models = options?.models ?? [];
  const modelOptions: SelectOption<string>[] = [
    { value: ALL, label: all },
    ...models.map((model) => ({ value: model, label: model })),
    ...(selection.model !== null && !models.includes(selection.model)
      ? [{ value: selection.model, label: selection.model }]
      : []),
  ];
  const typeOptions: SelectOption<LogType>[] = [
    { value: 'all', label: all },
    { value: 'text', label: t('filters.text') },
    { value: 'image', label: t('filters.image') },
  ];
  // 列设置的勾选项：时间固定显示
  const columnOptions: ColumnOption<LogColumn>[] = LOG_COLUMNS.map((id) => ({
    id,
    label: t(`table.${id}`),
    locked: id === 'time',
  }));
  const streamOptions: SelectOption<LogStream>[] = [
    { value: 'all', label: all },
    { value: 'stream', label: t('filters.streamOn') },
    { value: 'nonStream', label: t('filters.streamOff') },
  ];

  return (
    <Panel id="log-filters">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <FilterField label={t('filters.time')}>
          <DateRangePicker
            align="start"
            className="w-full"
            value={range}
            today={today}
            since={since}
            onChange={(next) => onChange({ range: next })}
          />
        </FilterField>
        <FilterField label={t('filters.key')}>
          <Select
            name="log-key"
            value={selection.keyId === null ? ALL : String(selection.keyId)}
            onChange={(value) => onChange({ keyId: value === ALL ? null : Number(value) })}
            options={keyOptions}
            ariaLabel={t('filters.key')}
          />
        </FilterField>
        <FilterField label={t('filters.model')}>
          <Select
            name="log-model"
            value={selection.model ?? ALL}
            onChange={(value) => onChange({ model: value === ALL ? null : value })}
            options={modelOptions}
            ariaLabel={t('filters.model')}
          />
        </FilterField>
        <FilterField label={t('filters.type')}>
          <Select
            name="log-type"
            value={selection.type}
            onChange={(type) => onChange({ type })}
            options={typeOptions}
            ariaLabel={t('filters.type')}
          />
        </FilterField>
        <FilterField label={t('filters.stream')}>
          <Select
            name="log-stream"
            value={selection.stream}
            onChange={(stream) => onChange({ stream })}
            options={streamOptions}
            ariaLabel={t('filters.stream')}
          />
        </FilterField>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        {exportFailed ? (
          <p role="alert" className="mr-auto text-sm text-danger">
            {t('error.export')}
          </p>
        ) : null}
        {dirty ? (
          <Button variant="ghost" className={CONTROL_BUTTON} data-clear-filters onClick={onClear}>
            {t('filters.clear')}
          </Button>
        ) : null}
        <ColumnPicker
          name="logs"
          columns={columnOptions}
          visible={columns}
          defaults={DEFAULT_LOG_COLUMNS}
          onSave={onSaveColumns}
        />
        <Button
          variant="secondary"
          className={CONTROL_BUTTON}
          data-export
          loading={exporting}
          disabled={!canExport || exporting}
          onClick={onExport}
        >
          <Download aria-hidden />
          {t('export')}
        </Button>
      </div>
    </Panel>
  );
}
