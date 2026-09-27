/**
 * M1 匿名模型目录价格测试夹具。
 *
 * 契约来源：design/public-site.md §2/§3 与 M1 测试任务书。
 * 顶层结构与后端 /api/v1/model-plaza 的匿名形状一致：
 *   { groups: [{ id, name, platform, subscription_type, is_exclusive,
 *                rate_multiplier, user_rate_multiplier?, models: [{ name,
 *                platform, pricing, official_pricing, time_pricing? }] }] }
 *
 * 基础组：标准、非专属、rate_multiplier=0.5、单模型 gpt-test。
 * 期待实收价：input 1.5 / output 7.5 / cacheWrite null / cacheRead 0（美元每百万）。
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/** 基础匿名目录：一份完整的合法输入。 */
export function baseCatalog(): JsonObject {
  return {
    groups: [
      {
        id: 1,
        name: '标准',
        platform: 'openai',
        subscription_type: 'standard',
        is_exclusive: false,
        rate_multiplier: 0.5,
        models: [
          {
            name: 'gpt-test',
            platform: 'openai',
            pricing: {
              billing_mode: 'token',
              input_price: 3e-6,
              output_price: 15e-6,
              cache_write_price: null,
              cache_read_price: 0,
              intervals: [],
            },
            official_pricing: { input_price: 99 },
          },
        ],
      },
    ],
  };
}

/** 深拷贝，保证用例之间不互相污染（保留 NaN / Infinity）。 */
export function clone<T extends Json>(value: T): T {
  return structuredClone(value);
}

export function groupsOf(catalog: JsonObject): JsonObject[] {
  return catalog.groups as JsonObject[];
}

export function groupAt(catalog: JsonObject, index = 0): JsonObject {
  return groupsOf(catalog)[index]!;
}

export function modelsOf(catalog: JsonObject, groupIndex = 0): JsonObject[] {
  return groupAt(catalog, groupIndex).models as JsonObject[];
}

export function modelAt(catalog: JsonObject, groupIndex = 0, modelIndex = 0): JsonObject {
  return modelsOf(catalog, groupIndex)[modelIndex]!;
}

export function pricingOf(catalog: JsonObject, groupIndex = 0, modelIndex = 0): JsonObject {
  return modelAt(catalog, groupIndex, modelIndex).pricing as JsonObject;
}

/** 追加一个与基础组同型号的标准组，返回该组以便覆写倍率等字段。 */
export function appendGroup(catalog: JsonObject, overrides: JsonObject = {}): JsonObject {
  const group = groupAt(catalog);
  const copy = clone(group) as JsonObject;
  Object.assign(copy, overrides);
  (catalog.groups as JsonObject[]).push(copy);
  return copy;
}
