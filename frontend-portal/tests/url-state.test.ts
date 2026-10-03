import { describe, expect, it } from 'vitest';

import { pickAllowed, readList, readParam, writeList, writeParam } from '@/lib/url-state-core';

describe('网址状态', () => {
  it('读写单个参数', () => {
    expect(readParam('?edition=pro&currency=cny', 'edition')).toBe('pro');
    expect(readParam('', 'edition')).toBeNull();
    expect(writeParam('?currency=cny', 'edition', 'pro')).toBe('?currency=cny&edition=pro');
    expect(writeParam('?edition=pro', 'edition', null)).toBe('');
    expect(writeParam('?edition=pro&q=gpt', 'q', '')).toBe('?edition=pro');
  });

  it('只接受允许列表里的值', () => {
    const allowed = ['personal', 'pro', 'enterprise'] as const;
    expect(pickAllowed('pro', allowed, 'personal')).toBe('pro');
    expect(pickAllowed('vip', allowed, 'personal')).toBe('personal');
    expect(pickAllowed(null, allowed, 'personal')).toBe('personal');
  });

  it('多选值去重、过滤并保持允许列表顺序', () => {
    const allowed = ['openai', 'anthropic', 'google'] as const;
    expect(readList('google,openai,unknown,openai', allowed)).toEqual(['openai', 'google']);
    expect(readList(null, allowed)).toEqual([]);
    expect(writeList(['openai', 'google'])).toBe('openai,google');
    expect(writeList([])).toBeNull();
  });
});
