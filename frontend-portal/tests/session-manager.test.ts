import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionManager, type SessionManager } from '../src/features/auth/session-manager';
import {
  parsePersistedSession,
  serializePersistedSession,
  SESSION_STORAGE_KEY,
  type PersistedSession,
  type StorageLike,
} from '../src/features/auth/session-storage';
import type { PortalUser } from '../src/features/auth/types';

const NOW = 1_700_000_000_000;

type FetchHandler = (url: string, init: RequestInit) => Promise<Response>;

function makeFetcher(handler: FetchHandler): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    handler(String(input), init ?? {})) as typeof fetch;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ code: 0, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string | number = 'REQUEST_FAILED'): Response {
  return new Response(JSON.stringify({ code, data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeUser(overrides: Partial<PortalUser> = {}): PortalUser {
  return {
    id: 1,
    email: 'alice@example.com',
    username: 'alice',
    balance: 10,
    frozenBalance: 0,
    role: 'user',
    organization: null,
    ...overrides,
  };
}

function loginValue(
  user: PortalUser = makeUser(),
  overrides: {
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: number;
  } = {},
): unknown {
  return {
    code: 0,
    data: {
      access_token: overrides.accessToken ?? 'access-a',
      refresh_token: overrides.refreshToken === undefined ? 'refresh-a' : overrides.refreshToken,
      expires_at: overrides.expiresAt ?? NOW + 60_000,
      user,
    },
  };
}

function makeStorage(initial: string | null = null): StorageLike & { peek(): string | null } {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    removeItem: () => {
      value = null;
    },
    peek: () => value,
  };
}

function makeBrokenStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('storage read failed');
    },
    setItem: () => {
      throw new Error('storage write failed');
    },
    removeItem: () => {
      throw new Error('storage remove failed');
    },
  };
}

function makeStorageEvents(): {
  onStorage: (listener: () => void) => () => void;
  emit: () => void;
  size: () => number;
} {
  const listeners = new Set<() => void>();
  return {
    onStorage: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    size: () => listeners.size,
  };
}

function makeSerialLock(): <T>(name: string, task: () => Promise<T>) => Promise<T> {
  let tail: Promise<void> = Promise.resolve();
  return async <T>(_name: string, task: () => Promise<T>): Promise<T> => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushMany(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

function header(init: RequestInit, name: string): string | undefined {
  const headers = init.headers;
  if (headers === undefined) {
    return undefined;
  }
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  }
  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()];
}

function bodyObject(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== 'string') {
    return {};
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('createSessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('starts anonymous without a persisted session and accepts an empty username', async () => {
    const storage = makeStorage();
    const events = makeStorageEvents();
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async () => {
        throw new Error('unexpected request');
      }),
      now: () => NOW,
      onStorage: events.onStorage,
    });

    await expect(manager.start()).resolves.toBeUndefined();
    expect(manager.getSnapshot()).toMatchObject({
      status: 'anonymous',
      user: null,
      identityKey: '',
      error: null,
    });

    await manager.acceptLogin(loginValue(makeUser({ username: '' })));

    expect(manager.getSnapshot()).toMatchObject({
      status: 'authenticated',
      user: { id: 1, username: '' },
    });
  });

  it('accepts a member organization summary with an empty status', async () => {
    const manager = createSessionManager({
      storage: makeStorage(),
      fetcher: makeFetcher(async () => {
        throw new Error('unexpected request');
      }),
      now: () => NOW,
    });

    await manager.acceptLogin({
      code: 0,
      data: {
        access_token: 'access-member',
        refresh_token: 'refresh-member',
        expires_at: NOW + 60_000,
        user: {
          id: 9,
          email: 'member@example.com',
          username: 'member',
          balance: 0,
          frozen_balance: 0,
          role: 'user',
          organization: {
            id: 77,
            name: 'Member Organization',
            is_owner: false,
            status: '',
          },
        },
      },
    });

    expect(manager.getSnapshot()).toMatchObject({
      status: 'authenticated',
      user: {
        id: 9,
        organization: {
          id: 77,
          name: 'Member Organization',
          isOwner: false,
          status: '',
        },
      },
    });
  });

  it('treats corrupted persisted data as anonymous and survives unavailable storage', async () => {
    const corruptedStorage = makeStorage('{ definitely not json');
    const corruptedManager = createSessionManager({
      storage: corruptedStorage,
      fetcher: makeFetcher(async () => {
        throw new Error('unexpected request');
      }),
      now: () => NOW,
    });

    await expect(corruptedManager.start()).resolves.toBeUndefined();
    expect(corruptedManager.getSnapshot().status).toBe('anonymous');

    let requestCount = 0;
    const brokenManager = createSessionManager({
      storage: makeBrokenStorage(),
      fetcher: makeFetcher(async (_url, init) => {
        requestCount += 1;
        expect(header(init, 'Authorization')).toBe('Bearer access-a');
        return jsonResponse({ accepted: true });
      }),
      now: () => NOW,
    });

    await expect(brokenManager.start()).resolves.toBeUndefined();
    await expect(brokenManager.acceptLogin(loginValue())).resolves.toBeUndefined();
    await expect(brokenManager.request('/storage-safe')).resolves.toEqual({ accepted: true });
    expect(requestCount).toBe(1);
    expect(brokenManager.getSnapshot().status).toBe('authenticated');
  });

  it('deduplicates concurrent 401 refreshes and persists the rotated refresh token', async () => {
    const storage = makeStorage();
    const refreshBodies: unknown[] = [];
    let rejectNextAuthenticatedRequest = false;
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url, init) => {
        if (url.endsWith('/protected')) {
          const authorization = header(init, 'Authorization');
          if (authorization === 'Bearer access-b' && rejectNextAuthenticatedRequest) {
            rejectNextAuthenticatedRequest = false;
            return errorResponse(401, 'TOKEN_EXPIRED_AGAIN');
          }
          if (authorization === 'Bearer access-a') {
            return errorResponse(401, 'TOKEN_EXPIRED');
          }
          return jsonResponse({ ok: true });
        }
        if (url.endsWith('/auth/refresh')) {
          refreshBodies.push(bodyObject(init).refresh_token);
          const isFirstRefresh = refreshBodies.length === 1;
          return jsonResponse({
            access_token: isFirstRefresh ? 'access-b' : 'access-c',
            refresh_token: isFirstRefresh ? 'refresh-b' : 'refresh-c',
            expires_at: NOW + (isFirstRefresh ? 120_000 : 180_000),
          });
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
    });

    await manager.acceptLogin(loginValue());
    const concurrent = await Promise.all([
      manager.request<{ ok: boolean }>('/protected'),
      manager.request<{ ok: boolean }>('/protected'),
    ]);

    expect(concurrent).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshBodies).toEqual(['refresh-a']);
    expect(parsePersistedSession(storage.peek())).toMatchObject({
      accessToken: 'access-b',
      refreshToken: 'refresh-b',
    });

    rejectNextAuthenticatedRequest = true;
    await expect(manager.request<{ ok: boolean }>('/protected')).resolves.toEqual({ ok: true });
    expect(refreshBodies).toEqual(['refresh-a', 'refresh-b']);
    expect(parsePersistedSession(storage.peek())).toMatchObject({
      accessToken: 'access-c',
      refreshToken: 'refresh-c',
    });
  });

  it('re-reads the token after waiting for a cross-tab refresh lock', async () => {
    const initial: PersistedSession = {
      accessToken: 'access-a',
      refreshToken: 'refresh-a',
      expiresAt: NOW + 60_000,
      userId: 1,
      generation: 'shared-generation',
    };
    const storage = makeStorage(serializePersistedSession(initial));
    const events = makeStorageEvents();
    const lock = makeSerialLock();
    const refreshResponse = deferred<Response>();
    let refreshCalls = 0;
    const user = makeUser();
    const fetcher = makeFetcher(async (url, init) => {
      if (url.endsWith('/auth/me')) {
        return jsonResponse(user);
      }
      if (url.endsWith('/protected')) {
        return header(init, 'Authorization') === 'Bearer access-b'
          ? jsonResponse({ ok: true })
          : errorResponse(401, 'TOKEN_EXPIRED');
      }
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return refreshResponse.promise;
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const options = {
      storage,
      fetcher,
      now: () => NOW,
      lock,
      onStorage: events.onStorage,
    };
    const first = createSessionManager(options);
    const second = createSessionManager(options);

    await Promise.all([first.start(), second.start()]);
    expect(events.size()).toBe(2);

    const pending = Promise.all([
      first.request<{ ok: boolean }>('/protected'),
      second.request<{ ok: boolean }>('/protected'),
    ]);
    await flushMany();
    expect(refreshCalls).toBe(1);

    refreshResponse.resolve(
      jsonResponse({
        access_token: 'access-b',
        refresh_token: 'refresh-b',
        expires_at: NOW + 120_000,
      }),
    );

    await expect(pending).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(parsePersistedSession(storage.peek())).toMatchObject({
      accessToken: 'access-b',
      refreshToken: 'refresh-b',
    });
  });

  it('keeps the session when refresh fails because the network is unavailable', async () => {
    const storage = makeStorage();
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url) => {
        if (url.endsWith('/protected')) {
          return errorResponse(401, 'TOKEN_EXPIRED');
        }
        if (url.endsWith('/auth/refresh')) {
          throw new TypeError('network is offline');
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
    });

    await manager.acceptLogin(loginValue());
    const before = storage.peek();
    await expect(manager.request('/protected')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(storage.peek()).toBe(before);
  });

  it('keeps the session when refresh is rate limited', async () => {
    const storage = makeStorage();
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url) => {
        if (url.endsWith('/protected')) {
          return errorResponse(401, 'TOKEN_EXPIRED');
        }
        if (url.endsWith('/auth/refresh')) {
          return errorResponse(429, 'RATE_LIMITED');
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
    });

    await manager.acceptLogin(loginValue());
    const before = storage.peek();
    await expect(manager.request('/protected')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(storage.peek()).toBe(before);
  });

  it('clears the session when the retry after refresh is still unauthorized', async () => {
    const storage = makeStorage();
    let protectedCalls = 0;
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url) => {
        if (url.endsWith('/protected')) {
          protectedCalls += 1;
          return errorResponse(401, protectedCalls === 1 ? 'TOKEN_EXPIRED' : 'TOKEN_REVOKED');
        }
        if (url.endsWith('/auth/refresh')) {
          return jsonResponse({
            access_token: 'access-b',
            refresh_token: 'refresh-b',
            expires_at: NOW + 120_000,
          });
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
    });

    await manager.acceptLogin(loginValue());
    await expect(manager.request('/protected')).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_REVOKED',
    });
    expect(protectedCalls).toBe(2);
    expect(manager.getSnapshot()).toMatchObject({ status: 'anonymous', user: null });
    expect(storage.peek()).toBeNull();
  });

  it('rejects a late refresh when the account changes while the request is pending', async () => {
    const storage = makeStorage();
    const refreshResponse = deferred<Response>();
    let refreshCalls = 0;
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url) => {
        if (url.endsWith('/old-resource')) {
          return errorResponse(401, 'TOKEN_EXPIRED');
        }
        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return refreshResponse.promise;
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
    });

    await manager.acceptLogin(loginValue(makeUser()));
    const oldRequest = manager.request('/old-resource');
    await flushMany();
    expect(refreshCalls).toBe(1);

    const newUser = makeUser({ id: 2, email: 'bob@example.com', username: 'bob' });
    await manager.acceptLogin(
      loginValue(newUser, { accessToken: 'access-b', refreshToken: 'refresh-b' }),
    );
    refreshResponse.resolve(
      jsonResponse({
        access_token: 'late-access',
        refresh_token: 'late-refresh',
        expires_at: NOW + 120_000,
      }),
    );

    await expect(oldRequest).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_CHANGED',
    });
    expect(manager.getSnapshot()).toMatchObject({ status: 'authenticated', user: newUser });
    expect(parsePersistedSession(storage.peek())).toMatchObject({
      accessToken: 'access-b',
      refreshToken: 'refresh-b',
      userId: 2,
    });
  });

  it('rejects a late refresh after logout without restoring the session', async () => {
    const storage = makeStorage();
    const refreshResponse = deferred<Response>();
    let refreshCalls = 0;
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url) => {
        if (url.endsWith('/old-resource')) {
          return errorResponse(401, 'TOKEN_EXPIRED');
        }
        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return refreshResponse.promise;
        }
        if (url.endsWith('/auth/logout')) {
          return jsonResponse(undefined);
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
    });

    await manager.acceptLogin(loginValue());
    const oldRequest = manager.request('/old-resource');
    await flushMany();
    expect(refreshCalls).toBe(1);

    await expect(manager.logout()).resolves.toBeUndefined();
    expect(manager.getSnapshot()).toMatchObject({ status: 'anonymous', user: null });
    expect(storage.peek()).toBeNull();

    refreshResponse.resolve(
      jsonResponse({
        access_token: 'late-access',
        refresh_token: 'late-refresh',
        expires_at: NOW + 120_000,
      }),
    );
    await expect(oldRequest).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_CHANGED',
    });
    expect(manager.getSnapshot().status).toBe('anonymous');
    expect(storage.peek()).toBeNull();
  });

  it('does not resurrect a session deleted by another tab while refresh is pending', async () => {
    const storage = makeStorage();
    const events = makeStorageEvents();
    const refreshResponse = deferred<Response>();
    let refreshCalls = 0;
    const manager = createSessionManager({
      storage,
      fetcher: makeFetcher(async (url, init) => {
        if (url.endsWith('/protected')) {
          return header(init, 'Authorization') === 'Bearer late-access'
            ? jsonResponse({ ok: true })
            : errorResponse(401, 'TOKEN_EXPIRED');
        }
        if (url.endsWith('/auth/refresh')) {
          refreshCalls += 1;
          return refreshResponse.promise;
        }
        throw new Error(`unexpected URL: ${url}`);
      }),
      now: () => NOW,
      onStorage: events.onStorage,
    });

    await manager.start();
    await manager.acceptLogin(loginValue());
    const oldRequest = manager.request('/protected');
    await flushMany();
    expect(refreshCalls).toBe(1);

    storage.removeItem(SESSION_STORAGE_KEY);
    refreshResponse.resolve(
      jsonResponse({
        access_token: 'late-access',
        refresh_token: 'late-refresh',
        expires_at: NOW + 120_000,
      }),
    );

    await expect(oldRequest).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_CHANGED',
    });
    expect(manager.getSnapshot()).toMatchObject({ status: 'anonymous', user: null });
    expect(storage.peek()).toBeNull();
    expect(events.size()).toBe(1);
  });

  it.each([
    ['missing refresh token', undefined],
    ['empty refresh token', ''],
  ])(
    'does not persist the old refresh token when the response has %s',
    async (_label, refreshToken) => {
      const storage = makeStorage();
      const manager = createSessionManager({
        storage,
        fetcher: makeFetcher(async (url, init) => {
          if (url.endsWith('/protected')) {
            return header(init, 'Authorization') === 'Bearer access-b'
              ? jsonResponse({ ok: true })
              : errorResponse(401, 'TOKEN_EXPIRED');
          }
          if (url.endsWith('/auth/refresh')) {
            const data: Record<string, unknown> = {
              access_token: 'access-b',
              expires_at: NOW + 120_000,
            };
            if (refreshToken !== undefined) {
              data.refresh_token = refreshToken;
            }
            return jsonResponse(data);
          }
          throw new Error(`unexpected URL: ${url}`);
        }),
        now: () => NOW,
      });

      await manager.acceptLogin(loginValue());
      const result = await manager
        .request('/protected')
        .then(() => 'resolved' as const)
        .catch(() => 'rejected' as const);
      expect(['resolved', 'rejected']).toContain(result);

      const persisted = parsePersistedSession(storage.peek());
      expect(persisted === null || persisted.refreshToken === null).toBe(true);
      expect(persisted?.refreshToken).not.toBe('refresh-a');
    },
  );

  it('can start, dispose, and start again like a StrictMode effect', async () => {
    const storage = makeStorage();
    const events = makeStorageEvents();
    let removedListeners = 0;
    const manager: SessionManager = createSessionManager({
      storage,
      fetcher: makeFetcher(async () => {
        throw new Error('unexpected request');
      }),
      now: () => NOW,
      onStorage: (listener) => {
        const remove = events.onStorage(listener);
        return () => {
          removedListeners += 1;
          remove();
        };
      },
    });

    await manager.start();
    expect(manager.getSnapshot().status).toBe('anonymous');
    expect(events.size()).toBe(1);

    manager.dispose();
    expect(removedListeners).toBe(1);
    expect(events.size()).toBe(0);

    await expect(manager.start()).resolves.toBeUndefined();
    expect(manager.getSnapshot().status).toBe('anonymous');
    expect(events.size()).toBe(1);

    const notifications: number[] = [];
    manager.subscribe(() => notifications.push(1));
    await manager.acceptLogin(loginValue());
    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(notifications).toHaveLength(1);
  });

  it('keeps a subscription created during StrictMode replay after dispose', async () => {
    const manager = createSessionManager({
      storage: makeStorage(),
      fetcher: makeFetcher(async () => {
        throw new Error('unexpected request');
      }),
      now: () => NOW,
    });
    const firstNotifications: string[] = [];
    const unsubscribeFirst = manager.subscribe(() => {
      firstNotifications.push(manager.getSnapshot().status);
    });

    await manager.start();
    unsubscribeFirst();
    manager.dispose();

    const secondNotifications: string[] = [];
    manager.subscribe(() => {
      secondNotifications.push(manager.getSnapshot().status);
    });
    await manager.start();
    await manager.acceptLogin(loginValue());

    expect(firstNotifications).toContain('anonymous');
    expect(secondNotifications).toContain('authenticated');
  });
});
