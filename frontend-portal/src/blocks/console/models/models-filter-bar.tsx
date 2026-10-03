'use client';

import { useTranslations } from 'next-intl';

import { FilterField, SearchInput } from '@/components/console/filter-field';
import { Select, type SelectOption } from '@/components/console/select';
import {
  CONTEXT_FILTERS,
  PROTOCOLS,
  PROTOCOL_LABELS,
  PROVIDERS,
  TYPE_FILTERS,
  type ContextFilter,
  type Protocol,
  type ProviderId,
  type TypeFilter,
} from '@/lib/catalog';

import type { ModelsQuery } from './models-state';

/** 各筛选值对应的文案键，写成完整字面量，类型检查才能确认键真的存在 */
const TYPE_LABEL = {
  all: 'filters.all',
  text: 'filters.text',
  image: 'filters.image',
} as const satisfies Record<TypeFilter, string>;

const CONTEXT_LABEL = {
  all: 'filters.all',
  '200k': 'filters.ctx200k',
  '1m': 'filters.ctx1m',
} as const satisfies Record<ContextFilter, string>;

/** 筛选栏：类型、厂商、上下文、协议四个下拉加一个搜索框 */
export function ModelsFilterBar({
  query,
  onChange,
}: {
  query: ModelsQuery;
  onChange: (change: Partial<ModelsQuery>) => void;
}) {
  const t = useTranslations('consoleModels');

  const typeOptions: SelectOption<TypeFilter>[] = TYPE_FILTERS.map((value) => ({
    value,
    label: t(TYPE_LABEL[value]),
  }));
  const providerOptions: SelectOption<ProviderId | 'all'>[] = [
    { value: 'all', label: t('filters.all') },
    ...PROVIDERS.map((provider) => ({ value: provider.id, label: provider.name })),
  ];
  const contextOptions: SelectOption<ContextFilter>[] = CONTEXT_FILTERS.map((value) => ({
    value,
    label: t(CONTEXT_LABEL[value]),
  }));
  const protocolOptions: SelectOption<Protocol | 'all'>[] = [
    { value: 'all', label: t('filters.all') },
    ...PROTOCOLS.map((protocol) => ({ value: protocol, label: PROTOCOL_LABELS[protocol] })),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <FilterField label={t('filters.type')}>
        <Select
          name="model-type"
          ariaLabel={t('filters.type')}
          value={query.type}
          onChange={(type) => onChange({ type })}
          options={typeOptions}
        />
      </FilterField>
      <FilterField label={t('filters.provider')}>
        <Select
          name="model-provider"
          ariaLabel={t('filters.provider')}
          value={query.provider}
          onChange={(provider) => onChange({ provider })}
          options={providerOptions}
        />
      </FilterField>
      <FilterField label={t('filters.context')}>
        <Select
          name="model-context"
          ariaLabel={t('filters.context')}
          value={query.context}
          onChange={(context) => onChange({ context })}
          options={contextOptions}
        />
      </FilterField>
      <FilterField label={t('filters.protocol')}>
        <Select
          name="model-protocol"
          ariaLabel={t('filters.protocol')}
          value={query.protocol}
          onChange={(protocol) => onChange({ protocol })}
          options={protocolOptions}
        />
      </FilterField>
      {/* 两列布局时搜索框独占最后一行，五列时回到单格 */}
      <FilterField
        label={t('filters.search')}
        htmlFor="model-search"
        className="sm:col-span-2 lg:col-span-1"
      >
        <SearchInput
          id="model-search"
          data-model-search
          placeholder={t('filters.searchPlaceholder')}
          value={query.query}
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </FilterField>
    </div>
  );
}
