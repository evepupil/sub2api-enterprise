import type { BackendError } from '@/lib/server/sub2api/envelope';

import type { TokenPair } from './cookies';

/**
 * 续期去重：同一个续期凭证同一时间只向后端换一次。
 *
 * 后端的续期凭证是一次性的：换过一次就作废，旧凭证再被拿去换，后端会认定凭证被盗用，
 * 把这次登录的整组凭证都作废，用户直接掉线。浏览器经常同时发出好几个请求，都带着同一个旧凭证，
 * 所以这里把同一个凭证的续期合并成一次，并把结果保留一小段时间，给稍后才到、仍带着旧凭证的请求复用。
 * 只在单个官网服务器进程内去重；部署多个官网进程时要让同一用户落在同一个进程上。
 */

export type RefreshOutcome = { ok: true; pair: TokenPair } | { ok: false; error: BackendError };

/** 换完的结果保留多久，毫秒 */
export const REFRESH_RESULT_TTL_MS = 30_000;

/** context 是发起续期的那个请求的附带信息（如用户 IP），只有真正去换的那一次会用到 */
export type Refresher<C> = (refreshToken: string, context: C) => Promise<RefreshOutcome>;

export function createRefresher<C>(
  exchange: (refreshToken: string, context: C) => Promise<RefreshOutcome>,
  now: () => number = Date.now,
): Refresher<C> {
  const inflight = new Map<string, Promise<RefreshOutcome>>();
  const recent = new Map<string, { outcome: RefreshOutcome; at: number }>();

  const prune = (at: number) => {
    for (const [token, entry] of recent) {
      if (at - entry.at > REFRESH_RESULT_TTL_MS) recent.delete(token);
    }
  };

  return (refreshToken, context) => {
    prune(now());

    const cached = recent.get(refreshToken);
    if (cached) return Promise.resolve(cached.outcome);

    const running = inflight.get(refreshToken);
    if (running) return running;

    const task = exchange(refreshToken, context)
      .catch((error: unknown): RefreshOutcome => ({
        ok: false,
        error: { status: 503, reason: 'PORTAL_BACKEND_UNAVAILABLE', message: String(error) },
      }))
      .then((outcome) => {
        inflight.delete(refreshToken);
        // 连不上后端这类临时故障不缓存，下一个请求可以再试
        if (outcome.ok || outcome.error.status < 500) {
          recent.set(refreshToken, { outcome, at: now() });
        }
        return outcome;
      });
    inflight.set(refreshToken, task);
    return task;
  };
}
