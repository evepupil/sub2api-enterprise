import type { AppLocale } from '@/i18n/routing';

import { editionRatio } from './groups';
import type { EditionId, Localized, Model } from './types';

/** 按 Token 计费的生图模型，估算一张 1024×1024 图消耗的输出 Token 数 */
export const IMAGE_TOKENS_PER_IMAGE = 1290;

/** 演示用的固定「今天」，「新上线」标记都从它算，避免构建与浏览器结果不一致 */
export const CATALOG_AS_OF = '2026-10-03';

/** 上线多少天内算「新」 */
export const NEW_MODEL_DAYS = 30;

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

export interface TextPriceView {
  input: number;
  output: number;
  cacheRead: number;
  longContext: { threshold: number; input: number; output: number } | null;
}

/** 文本模型按倍率换算后的单价（美元 / 百万 Token），倍率 1 即官方价 */
export function textPriceAt(model: Model, k: number): TextPriceView | null {
  if (model.type !== 'text' || !model.official) return null;
  return {
    input: round6(model.official.input * k),
    output: round6(model.official.output * k),
    cacheRead: round6(model.official.cacheRead * k),
    longContext: model.longContext
      ? {
          threshold: model.longContext.threshold,
          input: round6(model.longContext.input * k),
          output: round6(model.longContext.output * k),
        }
      : null,
  };
}

/** 某版本下文本模型的单价 = 官方价 × 分组倍率；倍率按合同定制的版本返回 null */
export function textPrice(model: Model, edition: EditionId): TextPriceView | null {
  const ratio = editionRatio(edition);
  return ratio === null ? null : textPriceAt(model, ratio);
}

export type ImagePriceView =
  | {
      kind: 'per-image';
      resolutions: { label: string; price: number }[];
      /** 最低一档，卡片上显示「起」 */
      from: number;
    }
  | {
      kind: 'per-token';
      perMTokens: number;
      /** 按 1024×1024 估算的每张价，显示时带「≈」 */
      estimatedPerImage: number;
    };

/** 生图模型按倍率换算后的价格，倍率 1 即官方价 */
export function imagePriceAt(model: Model, k: number): ImagePriceView | null {
  if (model.type !== 'image' || !model.image) return null;
  if (model.image.kind === 'per-image') {
    const resolutions = model.image.resolutions.map((r) => ({
      label: r.label,
      price: round6(r.price * k),
    }));
    return { kind: 'per-image', resolutions, from: Math.min(...resolutions.map((r) => r.price)) };
  }
  const perMTokens = round6(model.image.perMTokens * k);
  return {
    kind: 'per-token',
    perMTokens,
    estimatedPerImage: round6((perMTokens * IMAGE_TOKENS_PER_IMAGE) / 1_000_000),
  };
}

/** 某版本下生图模型的价格 = 官方价 × 分组倍率；倍率按合同定制的版本返回 null */
export function imagePrice(model: Model, edition: EditionId): ImagePriceView | null {
  const ratio = editionRatio(edition);
  return ratio === null ? null : imagePriceAt(model, ratio);
}

/** 折扣标：中文「3折」「1.5折」，英文「70% off」 */
export function formatDiscount(discount: number | null, locale: AppLocale): string | null {
  if (discount === null) return null;
  if (locale === 'zh') {
    const tenths = Math.round(discount * 100) / 10;
    return `${Number(tenths.toFixed(1))}折`;
  }
  return `${Math.round((1 - discount) * 100)}% off`;
}

/** 金额数字：≥100 最多 1 位小数，≥1 最多 2 位，<1 最多 4 位，去掉末尾的 0 */
export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
  return Number(value.toFixed(digits)).toString();
}

/** 美元金额：$0.6（官网价格只写美元，充值 1 元 = 1 美元） */
export function formatMoney(usd: number): string {
  return `$${formatAmount(usd)}`;
}

/** 上下文长度：1050000 → 1.05M，200000 → 200K */
export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(2))}M`;
  return `${Math.round(tokens / 1000)}K`;
}

export function localize(value: Localized, locale: AppLocale): string {
  return value[locale];
}

/** 是否在 CATALOG_AS_OF 之前 NEW_MODEL_DAYS 天内上线 */
export function isNewModel(model: Model): boolean {
  const days = (Date.parse(CATALOG_AS_OF) - Date.parse(model.released)) / 86_400_000;
  return days >= 0 && days <= NEW_MODEL_DAYS;
}
