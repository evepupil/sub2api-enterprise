import type { CatalogData, CatalogModel, PriceKey } from '../public/types';
import { identifyProvider } from './providers';
import { resolveCatalogPrices, type ParsedIntervalPricing, type ParsedPricing } from './pricing';

type UnknownRecord = Record<string, unknown>;

interface ParsedTimePricing {
  factors: readonly number[];
}

interface ParsedModel {
  name: string;
  platform: string;
  pricing: ParsedPricing | null;
  timePricing: ParsedTimePricing;
}

interface ParsedGroup {
  subscriptionType: string;
  isExclusive: boolean;
  rateMultiplier: number;
  userRateMultiplier: number | null;
  models: readonly ParsedModel[];
}

interface AggregateModel {
  name: string;
  provider: string;
  providerKey: string;
  prices: Record<PriceKey, number[]>;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`Invalid catalog field: ${path}`);
}

function requiredString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw invalid(key);
  }
  return value;
}

function requiredFiniteNumber(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(key);
  }
  return value;
}

function optionalFiniteNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(key);
  }
  return value;
}

function requiredNullableFiniteNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(key);
  }
  return value;
}

function requiredBoolean(record: UnknownRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw invalid(key);
  }
  return value;
}

function optionalBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key];
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'boolean') {
    throw invalid(key);
  }
  return value;
}

function requiredArray(record: UnknownRecord, key: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw invalid(key);
  }
  return value;
}

function optionalArray(record: UnknownRecord, key: string): readonly unknown[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalid(key);
  }
  return value;
}

function parsePrice(record: UnknownRecord, key: string): number | null {
  return optionalFiniteNumber(record, key);
}

function parseInterval(value: unknown, index: number): ParsedIntervalPricing {
  if (!isRecord(value)) {
    throw invalid(`pricing.intervals[${index}]`);
  }

  const minimumTokens = requiredFiniteNumber(value, 'min_tokens');
  const maximumTokens = requiredNullableFiniteNumber(value, 'max_tokens');
  if (maximumTokens !== null && maximumTokens < minimumTokens) {
    throw invalid(`pricing.intervals[${index}]`);
  }

  return {
    inputPrice: parsePrice(value, 'input_price'),
    outputPrice: parsePrice(value, 'output_price'),
    cacheWritePrice: parsePrice(value, 'cache_write_price'),
    cacheWrite1hPrice: parsePrice(value, 'cache_write_1h_price'),
    cacheReadPrice: parsePrice(value, 'cache_read_price'),
    inputMultiplier: parsePrice(value, 'input_multiplier'),
    outputMultiplier: parsePrice(value, 'output_multiplier'),
    cacheWriteMultiplier: parsePrice(value, 'cache_write_multiplier'),
    cacheReadMultiplier: parsePrice(value, 'cache_read_multiplier'),
  };
}

function parsePricing(value: unknown): ParsedPricing | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw invalid('pricing');
  }

  const intervals = optionalArray(value, 'intervals').map(parseInterval);
  return {
    billingMode: requiredString(value, 'billing_mode'),
    inputPrice: parsePrice(value, 'input_price'),
    outputPrice: parsePrice(value, 'output_price'),
    cacheWritePrice: parsePrice(value, 'cache_write_price'),
    cacheWrite1hPrice: parsePrice(value, 'cache_write_1h_price'),
    cacheReadPrice: parsePrice(value, 'cache_read_price'),
    maxReasoningEffortMultiplier: parsePrice(value, 'max_reasoning_effort_multiplier'),
    intervals,
  };
}

function parseClock(value: unknown, path: string, isEnd: boolean): number {
  if (typeof value !== 'string') {
    throw invalid(path);
  }
  if (isEnd && ['00:00', '00:00:00', '24:00', '24:00:00'].includes(value)) {
    return 24 * 60 * 60;
  }

  const match = /^(?:([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?)$/.exec(value);
  if (match === null) {
    throw invalid(path);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  return hours * 60 * 60 + minutes * 60 + seconds;
}

function coversWholeDay(intervals: readonly { start: number; end: number }[]): boolean {
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  let cursor = 0;
  for (const interval of sorted) {
    if (interval.start > cursor) {
      return false;
    }
    cursor = Math.max(cursor, interval.end);
  }
  return cursor === 24 * 60 * 60;
}

function parseTimePricing(value: unknown): ParsedTimePricing {
  if (value === undefined || value === null) {
    return { factors: [1] };
  }
  if (!isRecord(value)) {
    throw invalid('time_pricing');
  }

  const timezone = requiredString(value, 'timezone');
  if (timezone.trim().length === 0) {
    throw invalid('time_pricing.timezone');
  }
  const weekdaysOnly = optionalBoolean(value, 'weekdays_only') ?? false;
  const periods = requiredArray(value, 'periods');
  const parsedPeriods: { start: number; end: number; multiplier: number }[] = [];

  periods.forEach((period, index) => {
    if (!isRecord(period)) {
      throw invalid(`time_pricing.periods[${index}]`);
    }
    const start = parseClock(period.start_time, `time_pricing.periods[${index}].start_time`, false);
    const end = parseClock(period.end_time, `time_pricing.periods[${index}].end_time`, true);
    if (start >= end) {
      throw invalid(`time_pricing.periods[${index}]`);
    }
    parsedPeriods.push({
      start,
      end,
      multiplier: requiredFiniteNumber(period, 'multiplier'),
    });
  });

  const fullDay = !weekdaysOnly && coversWholeDay(parsedPeriods);
  const factors = fullDay
    ? parsedPeriods.map((period) => period.multiplier)
    : [1, ...parsedPeriods.map((period) => period.multiplier)];
  return { factors: [...new Set(factors)] };
}

function parseModel(value: unknown, index: number): ParsedModel {
  if (!isRecord(value)) {
    throw invalid(`models[${index}]`);
  }
  const name = requiredString(value, 'name').trim();
  if (name.length === 0) {
    throw invalid(`models[${index}].name`);
  }
  return {
    name,
    platform: requiredString(value, 'platform'),
    pricing: parsePricing(value.pricing),
    timePricing: parseTimePricing(value.time_pricing),
  };
}

function parseGroup(value: unknown, index: number): ParsedGroup {
  if (!isRecord(value)) {
    throw invalid(`groups[${index}]`);
  }

  requiredFiniteNumber(value, 'id');
  requiredString(value, 'name');
  requiredString(value, 'platform');
  const subscriptionType = requiredString(value, 'subscription_type');
  const isExclusive = requiredBoolean(value, 'is_exclusive');
  const rateMultiplier = requiredFiniteNumber(value, 'rate_multiplier');
  const userRateMultiplier = optionalFiniteNumber(value, 'user_rate_multiplier');
  const models = requiredArray(value, 'models').map(parseModel);
  return { subscriptionType, isExclusive, rateMultiplier, userRateMultiplier, models };
}

function appendRanges(target: Record<PriceKey, number[]>, ranges: CatalogModel['prices']): void {
  for (const key of Object.keys(target) as PriceKey[]) {
    const range = ranges[key];
    if (range !== null) {
      target[key].push(range.min, range.max);
    }
  }
}

export interface ParseCatalogOptions {
  authenticated?: boolean;
}

export function parseCatalog(value: unknown, options: ParseCatalogOptions = {}): CatalogData {
  if (!isRecord(value)) {
    throw invalid('root');
  }
  const groups = requiredArray(value, 'groups').map(parseGroup);
  const authenticated = options.authenticated === true;
  const aggregates = new Map<string, AggregateModel>();

  for (const group of groups) {
    const isBalanceGroup = group.subscriptionType === '' || group.subscriptionType === 'standard';
    if (!isBalanceGroup || (!authenticated && group.isExclusive)) {
      continue;
    }

    const rateMultiplier = authenticated
      ? (group.userRateMultiplier ?? group.rateMultiplier)
      : group.rateMultiplier;

    for (const model of group.models) {
      const provider = identifyProvider(model.name, model.platform);
      const aggregateKey = `${provider.providerKey}\u0000${provider.providerKey === 'other' ? provider.provider : ''}\u0000${model.name}`;
      let aggregate = aggregates.get(aggregateKey);
      if (aggregate === undefined) {
        aggregate = {
          name: model.name,
          provider: provider.provider,
          providerKey: provider.providerKey,
          prices: { input: [], cacheWrite: [], cacheRead: [], output: [] },
        };
        aggregates.set(aggregateKey, aggregate);
      }

      if (model.pricing === null || model.pricing.billingMode !== 'token') {
        continue;
      }
      appendRanges(
        aggregate.prices,
        resolveCatalogPrices(model.pricing, rateMultiplier, model.timePricing.factors),
      );
    }
  }

  const models: CatalogModel[] = [];
  for (const aggregate of aggregates.values()) {
    models.push({
      id: aggregate.name,
      provider: aggregate.provider,
      providerKey: aggregate.providerKey,
      prices: {
        input:
          aggregate.prices.input.length === 0
            ? null
            : {
                min: Math.min(...aggregate.prices.input),
                max: Math.max(...aggregate.prices.input),
              },
        cacheWrite:
          aggregate.prices.cacheWrite.length === 0
            ? null
            : {
                min: Math.min(...aggregate.prices.cacheWrite),
                max: Math.max(...aggregate.prices.cacheWrite),
              },
        cacheRead:
          aggregate.prices.cacheRead.length === 0
            ? null
            : {
                min: Math.min(...aggregate.prices.cacheRead),
                max: Math.max(...aggregate.prices.cacheRead),
              },
        output:
          aggregate.prices.output.length === 0
            ? null
            : {
                min: Math.min(...aggregate.prices.output),
                max: Math.max(...aggregate.prices.output),
              },
      },
    });
  }

  return { models };
}
