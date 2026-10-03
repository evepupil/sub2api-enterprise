'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import {
  formatMoney,
  formatRatio,
  getEdition,
  groupsFor,
  imagePrice,
  localize,
  MODELS,
  textPrice,
  type EditionId,
  type Group,
  type GroupKind,
} from '@/lib/catalog';

/** 示例行固定取的模型：按分组种类一个分组对一个模型（定制分组不出现在示例表里） */
type ExampleKind = Exclude<GroupKind, 'custom'>;

const EXAMPLE_MODEL: Record<ExampleKind, string> = {
  general: 'gpt-6-sol',
  image: 'gemini-3.1-flash-image',
  claude: 'claude-sonnet-5-5',
  priority: 'gpt-6-sol',
};

interface ExampleRow {
  group: Group;
  modelName: string;
  /** 基础价（个人版通用 / 生图分组），美元 */
  baseUsd: number;
  /** 生图按每张估算，前面加「≈」 */
  approx: boolean;
}

/** 组装示例表数据：倍率不为 null 的分组各一行，基础价一律取个人版默认分组价格 */
function buildRows(groups: readonly Group[]): ExampleRow[] {
  const rows: ExampleRow[] = [];
  for (const group of groups) {
    if (group.ratio === null || group.kind === 'custom') continue;
    // 守卫已排除 custom，但属性收窄推不过函数调用，这里显式标注收窄后的类型
    const kind: ExampleKind = group.kind;
    const model = MODELS.find((m) => m.id === EXAMPLE_MODEL[kind]);
    if (!model) continue;
    if (kind === 'image') {
      const price = imagePrice(model, 'personal');
      if (!price || price.kind !== 'per-token') continue;
      rows.push({ group, modelName: model.name, baseUsd: price.estimatedPerImage, approx: true });
    } else {
      const price = textPrice(model, 'personal');
      if (!price) continue;
      rows.push({ group, modelName: model.name, baseUsd: price.input, approx: false });
    }
  }
  return rows;
}

/** 倍率示例表：每行「示例模型的基础价 × 本分组倍率 = 实际价格」，跟随版本切换。 */
export function RatioExplainerExamples({ edition }: { edition: EditionId }) {
  const t = useTranslations('groups');
  const locale = useLocale();
  const ed = getEdition(edition);
  const rows = buildRows(groupsFor(edition));

  return (
    <div
      data-ratio-examples
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <span className="text-sm font-semibold text-foreground">
          {t('ratio.examplesTitle', { edition: localize(ed.name, locale) })}
        </span>
        <Badge tone="dark">{localize(ed.name, locale)}</Badge>
      </div>
      {/* 手机上放不下五列，横向滚动兜底 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="bg-surface text-xs text-subtle-foreground">
              <th scope="col" className="px-5 py-3 text-left font-medium">
                {t('ratio.group')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                {t('ratio.example')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('ratio.basePrice')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('ratio.ratioColumn')}
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                {t('ratio.result')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.group.id}
                data-ratio-row={row.group.kind}
                className="border-t border-border"
              >
                <td className="whitespace-nowrap px-5 py-3 text-foreground">
                  {localize(row.group.name, locale)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="block truncate">
                    {row.modelName} · {row.approx ? t('ratio.perImage') : t('ratio.input')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.approx ? '≈ ' : ''}
                  {formatMoney(row.baseUsd, 'usd')}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatRatio(row.group.ratio, locale)}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums text-foreground">
                  <span data-ratio-result>
                    {row.approx ? '≈ ' : ''}
                    {formatMoney(row.baseUsd * (row.group.ratio ?? 1), 'usd')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
