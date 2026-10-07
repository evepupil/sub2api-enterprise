import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/portal/health/route';

describe('健康检查', () => {
  it('只看官网进程，回 200 且不缓存', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true });
  });
});
