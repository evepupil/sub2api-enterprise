import { describe, expect, it } from 'vitest';

import {
  createRefresher,
  REFRESH_RESULT_TTL_MS,
  type RefreshOutcome,
} from '@/lib/server/session/refresh';

const pair = (n: number) => ({ accessToken: `a${n}`, refreshToken: `r${n}`, expiresIn: 600 });

describe('续期去重', () => {
  it('同一个续期凭证同时来多个请求，只向后端换一次', async () => {
    let calls = 0;
    let release: (value: RefreshOutcome) => void = () => {};
    const refresher = createRefresher<null>(() => {
      calls += 1;
      return new Promise<RefreshOutcome>((resolve) => {
        release = resolve;
      });
    });

    const first = refresher('r0', null);
    const second = refresher('r0', null);
    release({ ok: true, pair: pair(1) });
    expect(await first).toEqual({ ok: true, pair: pair(1) });
    expect(await second).toEqual({ ok: true, pair: pair(1) });
    expect(calls).toBe(1);
  });

  it('换完后一段时间内，带旧凭证晚到的请求直接拿到新凭证，过期后才重新换', async () => {
    let calls = 0;
    let clock = 1_000;
    const refresher = createRefresher<null>(
      async () => {
        calls += 1;
        return { ok: true, pair: pair(calls) };
      },
      () => clock,
    );

    expect(await refresher('r0', null)).toEqual({ ok: true, pair: pair(1) });
    clock += REFRESH_RESULT_TTL_MS - 1;
    expect(await refresher('r0', null)).toEqual({ ok: true, pair: pair(1) });
    clock += 2;
    expect(await refresher('r0', null)).toEqual({ ok: true, pair: pair(2) });
    expect(calls).toBe(2);
  });

  it('后端临时不可用不缓存，下一个请求可以再试；凭证无效的结果会缓存', async () => {
    let calls = 0;
    const outcomes: RefreshOutcome[] = [
      { ok: false, error: { status: 503, reason: 'PORTAL_BACKEND_UNAVAILABLE', message: '' } },
      { ok: false, error: { status: 401, reason: 'INVALID_REFRESH_TOKEN', message: '' } },
    ];
    const refresher = createRefresher<null>(async () => {
      const outcome = outcomes[calls] as RefreshOutcome;
      calls += 1;
      return outcome;
    });

    expect((await refresher('r0', null)).ok).toBe(false);
    expect((await refresher('r0', null)).ok).toBe(false);
    expect((await refresher('r0', null)).ok).toBe(false);
    expect(calls).toBe(2);
  });

  it('换的过程抛错按后端不可用处理', async () => {
    const refresher = createRefresher<null>(async () => {
      throw new Error('socket hang up');
    });
    const outcome = await refresher('r0', null);
    expect(outcome).toMatchObject({ ok: false, error: { status: 503 } });
  });

  it('只有真正去换的那一次用到请求附带信息', async () => {
    const seen: string[] = [];
    const refresher = createRefresher<string>(async (_token, context) => {
      seen.push(context);
      return { ok: true, pair: pair(1) };
    });
    await Promise.all([refresher('r0', 'first'), refresher('r0', 'second')]);
    expect(seen).toEqual(['first']);
  });
});
