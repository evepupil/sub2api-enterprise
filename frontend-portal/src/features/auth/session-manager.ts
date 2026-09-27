import type { ApiRequestOptions, ApiRequester, PortalUser, SessionSnapshot } from './types';
import { ApiError, isApiError, safeApiMessage } from './api-error';
import { parseAuthTokens, parseTokenPair, parseUser } from './session-parsers';
import {
  parsePersistedSession,
  serializePersistedSession,
  SESSION_STORAGE_KEY,
  type PersistedSession,
  type StorageLike,
} from './session-storage';

const PORTAL_BASE_PATH = '/api/portal';
const REFRESH_LOCK_NAME = 'model-portal.session.refresh';
const REQUEST_TIMEOUT_MS = 20_000;

export interface SessionManagerOptions {
  storage?: StorageLike;
  fetcher?: typeof fetch;
  now?: () => number;
  lock?: <T>(name: string, task: () => Promise<T>) => Promise<T>;
  onStorage?: (listener: () => void) => () => void;
}

export interface SessionManager {
  start(): Promise<void>;
  dispose(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SessionSnapshot;
  getServerSnapshot(): SessionSnapshot;
  request: ApiRequester;
  acceptLogin(value: unknown): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
}

interface Identity {
  epoch: number;
  userId: number | null;
  generation: string | null;
}

interface FetchResponseLike {
  status: number;
  json(): Promise<unknown>;
}

interface FetchInitLike {
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
  credentials: RequestCredentials;
  cache: RequestCache;
  signal: AbortSignal;
}

interface RefreshState {
  identity: Identity;
  promise: Promise<void>;
}

const SERVER_SNAPSHOT: SessionSnapshot = Object.freeze({
  status: 'anonymous',
  user: null,
  identityKey: '',
  error: null,
});

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserStorageEvents(): ((listener: () => void) => () => void) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return (listener: () => void): (() => void) => {
    const handler = (event: StorageEvent): void => {
      if (event.key === SESSION_STORAGE_KEY) {
        listener();
      }
    };
    try {
      window.addEventListener('storage', handler);
      return () => {
        try {
          window.removeEventListener('storage', handler);
        } catch {
          // A browser teardown must not break disposal.
        }
      };
    } catch {
      return () => undefined;
    }
  };
}

function browserLock(): SessionManagerOptions['lock'] | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks === undefined) {
    return undefined;
  }
  return async <T>(name: string, task: () => Promise<T>): Promise<T> =>
    await locks.request(name, () => task());
}

function defaultFetcher(): typeof fetch {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  return (async () => {
    throw new Error('fetch unavailable');
  }) as typeof fetch;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityKey(session: PersistedSession | null): string {
  return session === null ? '' : `${session.userId}:${session.generation}`;
}

function sameSessionIdentity(
  left: PersistedSession | null,
  right: PersistedSession | null,
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.userId === right.userId &&
    left.generation === right.generation
  );
}

function sameTokenPair(left: PersistedSession, right: PersistedSession): boolean {
  return (
    left.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken &&
    left.expiresAt === right.expiresAt
  );
}

function cloneUser(user: PortalUser | null): PortalUser | null {
  if (user === null) {
    return null;
  }
  const organization = user.organization === null ? null : Object.freeze({ ...user.organization });
  return Object.freeze({ ...user, organization });
}

function usersEqual(left: PortalUser | null, right: PortalUser | null): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return (
    left.id === right.id &&
    left.email === right.email &&
    left.username === right.username &&
    left.balance === right.balance &&
    left.frozenBalance === right.frozenBalance &&
    left.role === right.role &&
    ((left.organization === null && right.organization === null) ||
      (left.organization !== null &&
        right.organization !== null &&
        left.organization.id === right.organization.id &&
        left.organization.name === right.organization.name &&
        left.organization.isOwner === right.organization.isOwner &&
        left.organization.status === right.organization.status))
  );
}

function newGeneration(now: () => number, counter: number): string {
  const candidate = globalThis.crypto?.randomUUID?.();
  if (candidate !== undefined) {
    return candidate;
  }
  return `${now()}-${counter}-${Math.random().toString(36).slice(2)}`;
}

function validPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return false;
  }
  if (path.includes('://')) {
    return false;
  }
  const pathOnly = path.split(/[?#]/u)[0] ?? path;
  return pathOnly.split('/').every((segment) => segment !== '..');
}

function safeStatus(status: number): number {
  return Number.isFinite(status) && status >= 0 ? status : 0;
}

function errorCode(value: unknown): string | number | null {
  if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
    return value;
  }
  return null;
}

function sessionChangedError(): ApiError {
  return new ApiError(409, 'SESSION_CHANGED', safeApiMessage(409));
}

function isConfirmedInvalid(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  if (error.status === 401) {
    return true;
  }
  if (error.status !== 400) {
    return false;
  }
  return (
    typeof error.code === 'string' &&
    /(refresh|token|credential|session|auth|expired|revok|invalid|reus)/iu.test(error.code)
  );
}

/**
 * Construct the portal's browser-only session service. No browser global is read
 * until this function is called, which keeps server rendering safe.
 */
export function createSessionManager(options: SessionManagerOptions = {}): SessionManager {
  const storage: StorageLike | null = options.storage ?? browserStorage();
  const fetcher = options.fetcher ?? defaultFetcher();
  const now = options.now ?? Date.now;
  const lock = options.lock ?? browserLock();
  const storageEvents = options.onStorage ?? browserStorageEvents();

  let storageUsable = storage !== null;
  let memoryValue: string | null = null;
  let session: PersistedSession | null = null;
  let epoch = 0;
  let generationCounter = 0;
  let started = false;
  let disposed = false;
  let startPromise: Promise<void> | null = null;
  let refreshState: RefreshState | null = null;
  let removeStorageListener: (() => void) | null = null;
  let snapshot: SessionSnapshot = Object.freeze({
    status: 'loading',
    user: null,
    identityKey: '',
    error: null,
  });
  const listeners = new Set<() => void>();

  function readStorageValue(): string | null {
    if (!storageUsable || storage === null) {
      return memoryValue;
    }
    try {
      const value = storage.getItem(SESSION_STORAGE_KEY);
      memoryValue = value;
      return value;
    } catch {
      storageUsable = false;
      return memoryValue;
    }
  }

  function writeStorageValue(value: string): void {
    memoryValue = value;
    if (!storageUsable || storage === null) {
      return;
    }
    try {
      storage.setItem(SESSION_STORAGE_KEY, value);
    } catch {
      storageUsable = false;
    }
  }

  function removeStorageValue(): void {
    memoryValue = null;
    if (!storageUsable || storage === null) {
      return;
    }
    try {
      storage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      storageUsable = false;
    }
  }

  function readPersisted(): PersistedSession | null {
    return parsePersistedSession(readStorageValue());
  }

  function persist(next: PersistedSession): void {
    writeStorageValue(serializePersistedSession(next));
  }

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // One subscriber must not prevent the remaining subscribers from updating.
      }
    }
  }

  function setSnapshot(
    status: SessionSnapshot['status'],
    user: PortalUser | null,
    error: string | null,
  ): void {
    const nextUser = cloneUser(user);
    if (
      snapshot.status === status &&
      snapshot.error === error &&
      snapshot.identityKey === identityKey(session) &&
      usersEqual(snapshot.user, nextUser)
    ) {
      return;
    }
    snapshot = Object.freeze({
      status,
      user: nextUser,
      identityKey: identityKey(session),
      error,
    });
    notify();
  }

  function currentIdentity(): Identity {
    return {
      epoch,
      userId: session?.userId ?? null,
      generation: session?.generation ?? null,
    };
  }

  function identityMatches(identity: Identity): boolean {
    return (
      identity.epoch === epoch &&
      identity.userId === (session?.userId ?? null) &&
      identity.generation === (session?.generation ?? null)
    );
  }

  function assertUsable(): void {
    if (disposed) {
      throw sessionChangedError();
    }
  }

  function assertIdentity(identity: Identity): void {
    assertUsable();
    if (!identityMatches(identity)) {
      throw sessionChangedError();
    }
  }

  function transitionAnonymous(removePersisted: boolean, expected: Identity | null): boolean {
    if (expected !== null && !identityMatches(expected)) {
      return false;
    }
    const previous = session;
    const storedBeforeClear = previous === null ? null : readPersisted();
    if (
      previous !== null &&
      storedBeforeClear !== null &&
      !sameSessionIdentity(storedBeforeClear, previous)
    ) {
      // Another tab completed a login while this request was in flight. Adopt it
      // instead of clearing a newer account because an old token was rejected.
      adoptStoredSession(storedBeforeClear);
      setSnapshot('loading', null, null);
      const identity = currentIdentity();
      void verifySession(identity).catch(() => undefined);
      return false;
    }
    session = null;
    epoch += 1;
    if (removePersisted && previous !== null) {
      if (storedBeforeClear !== null && sameSessionIdentity(storedBeforeClear, previous)) {
        removeStorageValue();
      }
    }
    setSnapshot('anonymous', null, null);
    return true;
  }

  function adoptStoredSession(next: PersistedSession): void {
    if (session === null || !sameSessionIdentity(session, next)) {
      epoch += 1;
    }
    session = next;
  }

  function isCurrentStoredSession(next: PersistedSession | null): boolean {
    return next !== null && session !== null && sameSessionIdentity(next, session);
  }

  function reconcileStorage(): void {
    if (disposed || !started) {
      return;
    }
    const stored = readPersisted();
    if (stored === null) {
      if (session !== null) {
        transitionAnonymous(false, null);
      }
      return;
    }
    if (isCurrentStoredSession(stored)) {
      if (session !== null && !sameTokenPair(session, stored)) {
        session = stored;
      }
      return;
    }

    adoptStoredSession(stored);
    setSnapshot('loading', null, null);
    const identity = currentIdentity();
    void verifySession(identity).catch(() => undefined);
  }

  function installStorageListener(): void {
    if (removeStorageListener !== null || storageEvents === undefined) {
      return;
    }
    try {
      const remove = storageEvents(reconcileStorage);
      removeStorageListener = typeof remove === 'function' ? remove : () => undefined;
    } catch {
      removeStorageListener = null;
    }
  }

  async function performRawRequest(
    path: string,
    requestOptions: ApiRequestOptions,
    tokenOverride?: string | null,
  ): Promise<unknown> {
    assertUsable();
    if (!validPath(path)) {
      throw new ApiError(400, 'INVALID_PATH', '请求路径不正确');
    }

    const controller = new AbortController();
    const callerSignal = requestOptions.signal;
    let callerAbort: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectCallerAbort: (reason?: unknown) => void = () => undefined;

    const callerAbortPromise =
      callerSignal === undefined
        ? null
        : new Promise<never>((_resolve, reject) => {
            rejectCallerAbort = reject;
          });

    if (callerSignal !== undefined) {
      callerAbort = (): void => {
        const reason =
          callerSignal.reason ?? new DOMException('The operation was aborted', 'AbortError');
        controller.abort(reason);
        rejectCallerAbort(reason);
      };
      if (callerSignal.aborted) {
        callerAbort();
      } else {
        callerSignal.addEventListener('abort', callerAbort, { once: true });
      }
    }

    const headers: Record<string, string> = { ...(requestOptions.headers ?? {}) };
    const auth = requestOptions.auth !== false;
    const token = tokenOverride === undefined ? session?.accessToken : tokenOverride;
    if (auth && token !== undefined && token !== null && token.length > 0) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body: BodyInit | undefined;
    if (requestOptions.body !== undefined) {
      body =
        typeof requestOptions.body === 'string'
          ? requestOptions.body
          : JSON.stringify(requestOptions.body);
      if (headers['Content-Type'] === undefined) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const init: FetchInitLike = {
      method: requestOptions.method ?? 'GET',
      headers,
      ...(body === undefined ? {} : { body }),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    };

    const url = `${PORTAL_BASE_PATH}${path}`;
    const work = (async (): Promise<unknown> => {
      const response = (await fetcher(url, init)) as unknown as FetchResponseLike;
      const status = safeStatus(response.status);
      let payload: unknown;
      if (status === 204) {
        return undefined;
      }
      try {
        payload = await response.json();
      } catch {
        throw new ApiError(status, 'INVALID_RESPONSE', safeApiMessage(status));
      }

      if (status < 200 || status >= 300) {
        const code = isObject(payload) ? errorCode(payload.reason ?? payload.code) : null;
        throw new ApiError(status, code, safeApiMessage(status, code));
      }
      if (!isObject(payload) || payload.code !== 0) {
        const code = isObject(payload) ? errorCode(payload.reason ?? payload.code) : null;
        throw new ApiError(status, code ?? 'INVALID_RESPONSE', safeApiMessage(status, code));
      }
      return payload.data;
    })();

    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ApiError(408, 'TIMEOUT', safeApiMessage(408)));
      }, REQUEST_TIMEOUT_MS);
    });

    try {
      const pending: Promise<unknown>[] = [work, timeout];
      if (callerAbortPromise !== null) {
        pending.push(callerAbortPromise);
      }
      return await Promise.race(pending);
    } catch (error) {
      if (isApiError(error)) {
        throw error;
      }
      if (callerSignal?.aborted) {
        throw error;
      }
      throw new ApiError(0, 'NETWORK_ERROR', safeApiMessage(0));
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (callerSignal !== undefined && callerAbort !== null) {
        callerSignal.removeEventListener('abort', callerAbort);
      }
      controller.abort();
    }
  }

  async function refreshSession(expected: Identity): Promise<void> {
    assertIdentity(expected);
    if (session === null || session.refreshToken === null) {
      throw new ApiError(401, 'NO_REFRESH_TOKEN', '登录状态已失效');
    }

    if (refreshState !== null && identityMatches(refreshState.identity)) {
      return refreshState.promise;
    }

    const run = async (): Promise<void> => {
      assertIdentity(expected);
      const before = session;
      if (before === null || before.refreshToken === null) {
        throw new ApiError(401, 'NO_REFRESH_TOKEN', '登录状态已失效');
      }

      const reconcile = (): boolean => {
        const stored = readPersisted();
        if (stored === null) {
          return false;
        }
        if (!sameSessionIdentity(stored, before)) {
          throw sessionChangedError();
        }
        if (!sameTokenPair(stored, before)) {
          session = stored;
          return true;
        }
        return false;
      };

      const doNetworkRefresh = async (): Promise<void> => {
        assertIdentity(expected);
        if (reconcile()) {
          return;
        }
        try {
          const value = await performRawRequest(
            '/auth/refresh',
            {
              method: 'POST',
              body: { refresh_token: before.refreshToken },
              auth: false,
            },
            before.accessToken,
          );
          assertIdentity(expected);
          const pair = parseTokenPair(value, now);
          const storedAfter = readPersisted();
          if (storedAfter === null && storage !== null && storageUsable) {
            throw sessionChangedError();
          }
          if (storedAfter !== null && !sameSessionIdentity(storedAfter, before)) {
            throw sessionChangedError();
          }
          if (
            storedAfter !== null &&
            sameSessionIdentity(storedAfter, before) &&
            !sameTokenPair(storedAfter, before)
          ) {
            session = storedAfter;
            return;
          }

          const next: PersistedSession = {
            ...before,
            accessToken: pair.accessToken,
            refreshToken: pair.refreshToken,
            expiresAt: pair.expiresAt,
          };
          persist(next);
          session = next;
        } catch (error) {
          if (isApiError(error) && error.code === 'SESSION_CHANGED') {
            throw error;
          }
          const peer = readPersisted();
          if (peer !== null && sameSessionIdentity(peer, before) && !sameTokenPair(peer, before)) {
            session = peer;
            return;
          }
          throw error;
        }
      };

      if (lock !== undefined) {
        await lock(REFRESH_LOCK_NAME, doNetworkRefresh);
      } else {
        await doNetworkRefresh();
      }
      assertIdentity(expected);
    };

    const pending = run();
    refreshState = { identity: expected, promise: pending };
    const clear = (): void => {
      if (refreshState?.promise === pending) {
        refreshState = null;
      }
    };
    void pending.then(clear, clear);
    return pending;
  }

  async function requestWithRetry<T>(
    path: string,
    requestOptions: ApiRequestOptions = {},
    allowRefresh = true,
  ): Promise<T> {
    const auth = requestOptions.auth !== false;
    const expected = auth ? currentIdentity() : null;
    try {
      const value = await performRawRequest(path, requestOptions);
      if (expected !== null) {
        assertIdentity(expected);
      }
      return value as T;
    } catch (error) {
      if (
        !allowRefresh ||
        !auth ||
        expected === null ||
        !isApiError(error) ||
        error.status !== 401
      ) {
        throw error;
      }
      if (session === null || session.refreshToken === null) {
        transitionAnonymous(true, expected);
        throw error;
      }
      try {
        await refreshSession(expected);
      } catch (refreshError) {
        if (
          isConfirmedInvalid(refreshError) ||
          (isApiError(refreshError) && refreshError.code === 'SESSION_CHANGED')
        ) {
          transitionAnonymous(true, expected);
        }
        throw refreshError;
      }
      assertIdentity(expected);
      try {
        const retried = await performRawRequest(path, requestOptions);
        assertIdentity(expected);
        return retried as T;
      } catch (retryError) {
        if (isApiError(retryError) && retryError.status === 401) {
          transitionAnonymous(true, expected);
        }
        throw retryError;
      }
    }
  }

  async function verifySession(expected: Identity): Promise<void> {
    try {
      const value = await requestWithRetry<unknown>('/auth/me', { method: 'GET', auth: true });
      const user = parseUser(value);
      assertIdentity(expected);
      if (session === null || session.userId !== user.id) {
        transitionAnonymous(true, expected);
        return;
      }
      setSnapshot('authenticated', user, null);
    } catch (error) {
      if (!identityMatches(expected) || disposed) {
        return;
      }
      if (session === null) {
        setSnapshot('anonymous', null, null);
        return;
      }
      const message = isApiError(error) ? error.message : '登录状态暂时无法核实，请稍后重试';
      setSnapshot('error', null, message);
      throw error;
    }
  }

  async function start(): Promise<void> {
    if (disposed) {
      disposed = false;
      started = false;
      startPromise = null;
      refreshState = null;
      epoch += 1;
    }
    assertUsable();
    if (startPromise !== null) {
      return startPromise;
    }
    if (started && snapshot.status !== 'error') {
      return;
    }

    const run = async (): Promise<void> => {
      installStorageListener();
      const stored = readPersisted();
      if (stored === null) {
        session = null;
        started = true;
        setSnapshot('anonymous', null, null);
        return;
      }
      adoptStoredSession(stored);
      started = true;
      setSnapshot('loading', null, null);
      await verifySession(currentIdentity());
    };
    const pending = run();
    startPromise = pending;
    const clear = (): void => {
      if (startPromise === pending) {
        startPromise = null;
      }
    };
    void pending.then(clear, clear);
    return pending;
  }

  function subscribe(listener: () => void): () => void {
    // React may resubscribe before its effect restarts this manager.
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    epoch += 1;
    removeStorageListener?.();
    removeStorageListener = null;
    listeners.clear();
  }

  async function acceptLogin(value: unknown): Promise<void> {
    assertUsable();
    const parsed = parseAuthTokens(value, now);
    generationCounter += 1;
    const next: PersistedSession = {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      userId: parsed.user.id,
      generation: newGeneration(now, generationCounter),
    };
    persist(next);
    session = next;
    epoch += 1;
    started = true;
    setSnapshot('authenticated', parsed.user, null);
  }

  async function logout(): Promise<void> {
    assertUsable();
    const previous = session;
    const expected = currentIdentity();
    const refreshToken = previous?.refreshToken ?? null;
    const accessToken = previous?.accessToken ?? null;
    transitionAnonymous(true, expected);
    if (previous === null || refreshToken === null) {
      return;
    }

    try {
      await performRawRequest(
        '/auth/logout',
        {
          method: 'POST',
          body: { refresh_token: refreshToken },
          auth: false,
        },
        accessToken,
      );
    } catch {
      // Local logout has already completed; server revocation is best effort.
    }
  }

  async function refreshUser(): Promise<void> {
    assertUsable();
    const expected = currentIdentity();
    if (session === null) {
      transitionAnonymous(false, expected);
      return;
    }
    try {
      const value = await requestWithRetry<unknown>('/auth/me', { method: 'GET', auth: true });
      const user = parseUser(value);
      assertIdentity(expected);
      if (session === null || session.userId !== user.id) {
        transitionAnonymous(true, expected);
        throw sessionChangedError();
      }
      setSnapshot('authenticated', user, null);
    } catch (error) {
      if (identityMatches(expected) && session !== null && !isApiError(error)) {
        setSnapshot('error', snapshot.user, '账号资料暂时无法更新，请稍后重试');
      }
      throw error;
    }
  }

  const request: ApiRequester = <T = unknown>(
    path: string,
    requestOptions: ApiRequestOptions = {},
  ): Promise<T> => requestWithRetry<T>(path, requestOptions);

  return {
    start,
    dispose,
    subscribe,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    request,
    acceptLogin,
    logout,
    refreshUser,
  };
}

export type { StorageLike } from './session-storage';
