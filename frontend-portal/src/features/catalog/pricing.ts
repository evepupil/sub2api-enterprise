import type { CatalogModel, PriceKey, PriceRange } from '../public/types';

export interface ParsedIntervalPricing {
  inputPrice: number | null;
  outputPrice: number | null;
  cacheWritePrice: number | null;
  cacheWrite1hPrice: number | null;
  cacheReadPrice: number | null;
  inputMultiplier: number | null;
  outputMultiplier: number | null;
  cacheWriteMultiplier: number | null;
  cacheReadMultiplier: number | null;
}

export interface ParsedPricing {
  billingMode: string;
  inputPrice: number | null;
  outputPrice: number | null;
  cacheWritePrice: number | null;
  cacheWrite1hPrice: number | null;
  cacheReadPrice: number | null;
  maxReasoningEffortMultiplier: number | null;
  intervals: readonly ParsedIntervalPricing[];
}

export type CatalogPriceRanges = CatalogModel['prices'];

function resolveIntervalPrice(
  absolutePrice: number | null,
  basePrice: number | null,
  multiplier: number | null,
): number | null {
  if (absolutePrice !== null) {
    return absolutePrice;
  }
  if (basePrice === null) {
    return null;
  }
  return basePrice * (multiplier ?? 1);
}

function reasoningFactors(multiplier: number | null): readonly number[] {
  if (multiplier === null || multiplier === 0 || multiplier === 1) {
    return [1];
  }
  return [1, multiplier];
}

function createAccumulator(): Record<PriceKey, number[]> {
  return {
    input: [],
    cacheWrite: [],
    cacheRead: [],
    output: [],
  };
}

function addCandidate(
  values: number[],
  price: number | null,
  groupRate: number,
  timeFactors: readonly number[],
  reasoningMultipliers: readonly number[],
): void {
  if (price === null) {
    return;
  }

  for (const timeFactor of timeFactors) {
    for (const reasoningMultiplier of reasoningMultipliers) {
      const candidate = price * groupRate * timeFactor * reasoningMultiplier * 1_000_000;
      if (!Number.isFinite(candidate) || candidate < 0) {
        throw new Error('Catalog price is outside the supported numeric range');
      }
      values.push(candidate);
    }
  }
}

function rangeFromValues(values: readonly number[]): PriceRange | null {
  if (values.length === 0) {
    return null;
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** 将实收 token 单价与组、分时、推理倍率合成为美元/百万 Token 区间。 */
export function resolveCatalogPrices(
  pricing: ParsedPricing,
  groupRate: number,
  timeFactors: readonly number[],
): CatalogPriceRanges {
  const values = createAccumulator();
  const reasoningMultipliers = reasoningFactors(pricing.maxReasoningEffortMultiplier);
  const factors = timeFactors.length === 0 ? [1] : timeFactors;

  addCandidate(values.input, pricing.inputPrice, groupRate, factors, reasoningMultipliers);
  addCandidate(values.output, pricing.outputPrice, groupRate, factors, reasoningMultipliers);
  addCandidate(
    values.cacheWrite,
    pricing.cacheWritePrice,
    groupRate,
    factors,
    reasoningMultipliers,
  );
  addCandidate(
    values.cacheWrite,
    pricing.cacheWrite1hPrice,
    groupRate,
    factors,
    reasoningMultipliers,
  );
  addCandidate(values.cacheRead, pricing.cacheReadPrice, groupRate, factors, reasoningMultipliers);

  for (const interval of pricing.intervals) {
    addCandidate(
      values.input,
      resolveIntervalPrice(interval.inputPrice, pricing.inputPrice, interval.inputMultiplier),
      groupRate,
      factors,
      reasoningMultipliers,
    );
    addCandidate(
      values.output,
      resolveIntervalPrice(interval.outputPrice, pricing.outputPrice, interval.outputMultiplier),
      groupRate,
      factors,
      reasoningMultipliers,
    );

    const cacheWritePrice = resolveIntervalPrice(
      interval.cacheWritePrice,
      pricing.cacheWritePrice,
      interval.cacheWriteMultiplier,
    );
    const cacheWrite1hPrice =
      interval.cacheWrite1hPrice ??
      interval.cacheWritePrice ??
      resolveIntervalPrice(null, pricing.cacheWrite1hPrice, interval.cacheWriteMultiplier);
    addCandidate(values.cacheWrite, cacheWritePrice, groupRate, factors, reasoningMultipliers);
    addCandidate(values.cacheWrite, cacheWrite1hPrice, groupRate, factors, reasoningMultipliers);
    addCandidate(
      values.cacheRead,
      resolveIntervalPrice(
        interval.cacheReadPrice,
        pricing.cacheReadPrice,
        interval.cacheReadMultiplier,
      ),
      groupRate,
      factors,
      reasoningMultipliers,
    );
  }

  return {
    input: rangeFromValues(values.input),
    cacheWrite: rangeFromValues(values.cacheWrite),
    cacheRead: rangeFromValues(values.cacheRead),
    output: rangeFromValues(values.output),
  };
}
