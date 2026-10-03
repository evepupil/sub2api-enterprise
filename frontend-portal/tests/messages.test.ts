import { describe, expect, it } from 'vitest';

import { messagesByLocale } from '@/messages';

/** 收集对象里所有叶子键的路径，如 hero.title */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

function collectStrings(value: unknown, path: string, out: [string, string][]) {
  if (typeof value === 'string') out.push([path, value]);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      collectStrings(v, `${path}.${k}`, out);
}

describe('中英文文案', () => {
  it('每个命名空间的键完全一致', () => {
    const { zh, en } = messagesByLocale;
    for (const ns of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(keyPaths(en[ns]).sort(), ns).toEqual(keyPaths(zh[ns]).sort());
    }
  });

  it('没有空文案', () => {
    for (const locale of ['zh', 'en'] as const) {
      const strings: [string, string][] = [];
      collectStrings(messagesByLocale[locale], locale, strings);
      for (const [path, text] of strings) expect(text.trim(), path).not.toBe('');
    }
  });
});
