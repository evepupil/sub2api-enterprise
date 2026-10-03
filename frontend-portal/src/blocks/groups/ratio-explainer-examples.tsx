import { useLocale, useTranslations } from 'next-intl';

import {
  EDITIONS,
  formatMoney,
  formatRatio,
  imagePriceAt,
  localize,
  MODELS,
  textPriceAt,
  type Model,
} from '@/lib/catalog';

/** 示例行固定取的模型：两个文本模型看输入单价，一个生图模型看估算每张价 */
const EXAMPLE_MODEL_IDS = ['gpt-6-sol', 'claude-sonnet-5-5', 'gemini-3.1-flash-image'] as const;

/** 按倍率算一个示例模型的单价：文本取输入单价，生图取每张价（按 Token 计费的取估算值） */
function exampleUsd(model: Model, k: number): number | null {
  const text = textPriceAt(model, k);
  if (text) return text.input;
  const image = imagePriceAt(model, k);
  if (!image) return null;
  return image.kind === 'per-image' ? image.from : image.estimatedPerImage;
}

interface ExampleRow {
  model: Model;
  /** 生图按每张估算，金额前加「≈」 */
  approx: boolean;
  officialUsd: number;
}

function buildRows(): ExampleRow[] {
  const rows: ExampleRow[] = [];
  for (const id of EXAMPLE_MODEL_IDS) {
    const model = MODELS.find((m) => m.id === id);
    if (!model) continue;
    const officialUsd = exampleUsd(model, 1);
    if (officialUsd === null) continue;
    rows.push({ model, approx: model.type === 'image', officialUsd });
  }
  return rows;
}

/** 倍率示例表：每行一个示例模型，官方价后面依次是三个版本的实际价格，企业版显示「定制」。 */
export function RatioExplainerExamples() {
  const t = useTranslations('groups');
  const locale = useLocale();
  const rows = buildRows();
  const money = (usd: number, approx: boolean) => `${approx ? '≈ ' : ''}${formatMoney(usd, 'usd')}`;

  return (
    <div
      data-ratio-examples
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="border-b border-border px-5 py-4">
        <span className="text-sm font-semibold text-foreground">{t('ratio.examplesTitle')}</span>
      </div>
      {/* 手机上放不下五列，横向滚动兜底 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-surface text-xs text-subtle-foreground">
              <th scope="col" className="px-5 py-3 text-left font-medium">
                {t('ratio.example')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('ratio.official')}
              </th>
              {EDITIONS.map((edition) => (
                <th
                  key={edition.id}
                  scope="col"
                  data-ratio-col={edition.id}
                  className="px-4 py-3 text-right font-medium last:pr-5"
                >
                  <span className="block text-foreground">{localize(edition.name, locale)}</span>
                  <span className="block font-mono tabular-nums">
                    {formatRatio(edition.ratio, locale)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.model.id}
                data-ratio-row={row.model.id}
                className="border-t border-border"
              >
                <td className="px-5 py-3 text-foreground">
                  <span className="block truncate">{row.model.name}</span>
                  <span className="block text-xs text-subtle-foreground">
                    {row.approx ? t('ratio.perImage') : t('ratio.input')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {money(row.officialUsd, row.approx)}
                </td>
                {EDITIONS.map((edition) => {
                  const usd = edition.ratio === null ? null : exampleUsd(row.model, edition.ratio);
                  return (
                    <td
                      key={edition.id}
                      data-ratio-result={edition.id}
                      className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-foreground last:pr-5"
                    >
                      {usd === null ? formatRatio(null, locale) : money(usd, row.approx)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
