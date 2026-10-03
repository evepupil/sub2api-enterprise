import { formatMoney, imagePriceAt, textPriceAt, type Currency, type Model } from '@/lib/catalog';

/**
 * 模型表里一格价格要显示的内容（金额已按币种格式化，文案由展示组件按语言拼）：
 * - 文本模型：「输入 / 输出」，部分模型还有超过某个上下文长度后的加价档；
 * - 生图模型按张计费：显示最低一档的「起价」；
 * - 生图模型按 Token 计费：显示按 1024×1024 估算的「≈ 每张」。
 */
export type PriceView =
  | {
      kind: 'text';
      input: string;
      output: string;
      longContext: { threshold: number; input: string; output: string } | null;
    }
  | { kind: 'image-from'; price: string }
  | { kind: 'image-approx'; price: string };

/** 按通道倍率 k 算出价格视图，k = 1 就是官方价；不是可计价的模型时返回 null */
export function priceViewAt(model: Model, k: number, currency: Currency): PriceView | null {
  const text = textPriceAt(model, k);
  if (text) {
    return {
      kind: 'text',
      input: formatMoney(text.input, currency),
      output: formatMoney(text.output, currency),
      longContext: text.longContext
        ? {
            threshold: text.longContext.threshold,
            input: formatMoney(text.longContext.input, currency),
            output: formatMoney(text.longContext.output, currency),
          }
        : null,
    };
  }

  const image = imagePriceAt(model, k);
  if (!image) return null;
  return image.kind === 'per-image'
    ? { kind: 'image-from', price: formatMoney(image.from, currency) }
    : { kind: 'image-approx', price: formatMoney(image.estimatedPerImage, currency) };
}
