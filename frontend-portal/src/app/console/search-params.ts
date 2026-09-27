/**
 * 控制台页面 searchParams 取值（服务端，仅控制台目录使用）。
 *
 * 契约来源：design/console-pages.md 用量明细 / 余额与订单章节。
 * 只接受严格正整数：非数字、负数、小数、空串与数组一律返回 undefined，
 * 由视图按「没有带入 id」的默认行为处理，不猜测、不截断。
 */

type SearchParamsValue = string | string[] | undefined;

function firstParam(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/** 解析严格正整数（允许正号，不接受小数、指数、空白或前后缀）。 */
export function parsePositiveInteger(value: SearchParamsValue): number | undefined {
  const raw = firstParam(value);
  if (raw === undefined) {
    return undefined;
  }
  const text = raw.trim();
  if (!/^\+?\d+$/u.test(text)) {
    return undefined;
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}
