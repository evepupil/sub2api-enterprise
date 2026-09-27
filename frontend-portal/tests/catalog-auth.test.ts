import { describe, expect, it } from 'vitest';
import { parseCatalog } from '../src/features/catalog/adapter';
import {
  appendGroup,
  baseCatalog,
  groupAt,
  modelAt,
  pricingOf,
  type JsonObject,
} from './fixtures/catalog';

function renameModel(catalog: JsonObject, groupIndex: number, name: string): void {
  modelAt(catalog, groupIndex).name = name;
}

function setFourPrices(catalog: JsonObject): void {
  Object.assign(pricingOf(catalog), {
    cache_write_price: 2e-6,
    cache_read_price: 1e-6,
  });
}

describe('authenticated catalog boundaries', () => {
  it('keeps anonymous M1 visibility and includes only standard exclusive groups after login', () => {
    const catalog = baseCatalog();
    appendGroup(catalog, {
      id: 2,
      name: '专属余额组',
      subscription_type: 'standard',
      is_exclusive: true,
      user_rate_multiplier: 0.25,
    });
    renameModel(catalog, 1, 'exclusive-model');
    appendGroup(catalog, {
      id: 3,
      name: '订阅套餐',
      subscription_type: 'premium',
      is_exclusive: false,
    });
    renameModel(catalog, 2, 'subscription-model');

    const anonymous = parseCatalog(catalog);
    expect(anonymous.models.map((model) => model.id)).toEqual(['gpt-test']);
    expect(anonymous.models[0]?.prices.input).toEqual({ min: 1.5, max: 1.5 });

    const authenticated = parseCatalog(catalog, { authenticated: true });
    expect(authenticated.models.map((model) => model.id)).toEqual(['gpt-test', 'exclusive-model']);
    expect(authenticated.models.map((model) => model.id)).not.toContain('subscription-model');
  });

  it('uses a present user rate multiplier for all four price dimensions', () => {
    const catalog = baseCatalog();
    setFourPrices(catalog);
    groupAt(catalog).user_rate_multiplier = 0.4;

    const prices = parseCatalog(catalog, { authenticated: true }).models[0]?.prices;

    expect(prices?.input?.min).toBeCloseTo(1.2, 10);
    expect(prices?.input?.max).toBeCloseTo(1.2, 10);
    expect(prices?.output?.min).toBeCloseTo(6, 10);
    expect(prices?.output?.max).toBeCloseTo(6, 10);
    expect(prices?.cacheWrite?.min).toBeCloseTo(0.8, 10);
    expect(prices?.cacheWrite?.max).toBeCloseTo(0.8, 10);
    expect(prices?.cacheRead?.min).toBeCloseTo(0.4, 10);
    expect(prices?.cacheRead?.max).toBeCloseTo(0.4, 10);
  });

  it('keeps an explicit zero user multiplier without multiplying it twice', () => {
    const catalog = baseCatalog();
    setFourPrices(catalog);
    groupAt(catalog).user_rate_multiplier = 0;

    const prices = parseCatalog(catalog, { authenticated: true }).models[0]?.prices;

    expect(prices).toEqual({
      input: { min: 0, max: 0 },
      output: { min: 0, max: 0 },
      cacheWrite: { min: 0, max: 0 },
      cacheRead: { min: 0, max: 0 },
    });
  });

  it.each([undefined, null])(
    'falls back to the group multiplier when user multiplier is %s',
    (value) => {
      const catalog = baseCatalog();
      setFourPrices(catalog);
      if (value === undefined) {
        delete groupAt(catalog).user_rate_multiplier;
      } else {
        groupAt(catalog).user_rate_multiplier = value;
      }

      const prices = parseCatalog(catalog, { authenticated: true }).models[0]?.prices;

      expect(prices?.input).toEqual({ min: 1.5, max: 1.5 });
      expect(prices?.output).toEqual({ min: 7.5, max: 7.5 });
      expect(prices?.cacheWrite).toEqual({ min: 1, max: 1 });
      expect(prices?.cacheRead).toEqual({ min: 0.5, max: 0.5 });
    },
  );
});
