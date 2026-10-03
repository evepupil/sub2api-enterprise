'use client';

import { useLocale, useTranslations } from 'next-intl';

import { FilterField } from '@/components/console/filter-field';
import { Select, type SelectOption } from '@/components/console/select';
import { Badge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import { CHAT_MODEL_IDS } from '@/lib/console';
import { formatMoney, formatRatio, getEdition, getModel, textPrice } from '@/lib/catalog';

import { CHAT_KEYS } from './chat-keys';

const MODEL_OPTIONS: SelectOption<string>[] = CHAT_MODEL_IDS.map((id) => ({
  value: id,
  label: getModel(id).name,
}));

const KEY_OPTIONS: SelectOption<string>[] = CHAT_KEYS.map((key) => ({
  value: key.id,
  label: key.name,
}));

/**
 * 对话工具条：选模型、选密钥，右边写出所选密钥所在的通道和该通道下这个模型的价格。
 * 价格 = 官方价 × 通道倍率，让人发消息之前就知道大概花多少钱。
 */
export function ChatToolbar({
  model,
  onModelChange,
  keyId,
  onKeyChange,
}: {
  model: string;
  onModelChange: (model: string) => void;
  keyId: string;
  onKeyChange: (keyId: string) => void;
}) {
  const t = useTranslations('consoleChat');
  const locale = useLocale() as AppLocale;

  const apiKey = CHAT_KEYS.find((key) => key.id === keyId) ?? CHAT_KEYS[0];
  const edition = apiKey ? getEdition(apiKey.group) : null;
  // 倍率按合同定制的通道没有固定单价，只显示通道标签
  const price = apiKey ? textPrice(getModel(model), apiKey.group) : null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterField label={t('model')}>
        <Select
          name="chat-model"
          className="w-64"
          ariaLabel={t('model')}
          value={model}
          onChange={onModelChange}
          options={MODEL_OPTIONS}
        />
      </FilterField>
      <FilterField label={t('key')}>
        <Select
          name="chat-key"
          className="w-56"
          ariaLabel={t('key')}
          value={apiKey?.id ?? keyId}
          onChange={onKeyChange}
          options={KEY_OPTIONS}
        />
      </FilterField>
      {edition ? (
        <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {/* 徽标自带 self-start，这里要和旁边的价格文字垂直居中对齐 */}
          <Badge tone="outline" className="self-center">
            {edition.name[locale]} {formatRatio(edition.ratio, locale)}
          </Badge>
          {price ? (
            <span className="text-xs tabular-nums text-subtle-foreground">
              {t('pricing', {
                input: formatMoney(price.input, 'usd'),
                output: formatMoney(price.output, 'usd'),
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
