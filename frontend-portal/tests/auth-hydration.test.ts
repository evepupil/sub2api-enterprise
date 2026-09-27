// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  return {
    replace,
    push,
    router: { replace, push },
    pathname: '/console',
    searchParams: new URLSearchParams(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

import { AuthProvider } from '../src/features/auth/auth-provider';
import { ConsoleFrame } from '../src/features/console/console-frame';
import {
  serializePersistedSession,
  SESSION_STORAGE_KEY,
} from '../src/features/auth/session-storage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEST_USER = {
  id: 41,
  email: 'auth-hydration@example.invalid',
  username: 'auth-hydration',
  balance: 100,
  frozenBalance: 0,
  role: 'user' as const,
  organization: null,
};

const TEST_SESSION = {
  accessToken: 'auth-hydration-access',
  refreshToken: 'auth-hydration-refresh',
  expiresAt: 2_000_000_000_000,
  userId: TEST_USER.id,
  generation: 'auth-hydration-generation',
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ code: 0, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number): Response {
  return new Response(JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function seedSession(): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, serializePersistedSession(TEST_SESSION));
}

function privateContent(): React.ReactElement {
  return React.createElement('div', { 'data-testid': 'private-content' }, 'private content');
}

function createApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const tree = React.createElement(
    React.StrictMode,
    null,
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        AuthProvider,
        null,
        React.createElement(ConsoleFrame, null, privateContent()),
      ),
    ),
  );
  return { queryClient, tree };
}

type AppHandle = {
  container: HTMLDivElement;
  queryClient: QueryClient;
  root: Root;
  renderSequence: string[];
};

async function mountHydratedApp(): Promise<AppHandle> {
  const { queryClient, tree } = createApp();
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = renderToString(tree);
  const renderSequence: string[] = [];
  let root!: Root;
  await act(async () => {
    root = hydrateRoot(container, tree);
  });
  return { container, queryClient, root, renderSequence };
}

function currentStage(container: HTMLElement): string {
  if (container.querySelector('[data-testid="private-content"]') !== null) {
    return 'private';
  }
  if (container.querySelector('[role="alert"]') !== null) {
    return 'error';
  }
  if (container.querySelector('[role="status"]') !== null) {
    return 'checking';
  }
  return 'unknown';
}

async function waitFor(
  condition: () => boolean,
  description: string,
  container: HTMLElement,
  renderSequence: string[],
): Promise<void> {
  const deadline = Date.now() + 1_500;
  while (!condition()) {
    const stage = currentStage(container);
    if (renderSequence[renderSequence.length - 1] !== stage) {
      renderSequence.push(stage);
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for ${description}; render sequence: ${renderSequence.join(' -> ') || 'empty'}; ` +
          `router replacements: ${navigation.replace.mock.calls.map(([href]) => String(href)).join(', ') || 'none'}`,
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const stage = currentStage(container);
  if (renderSequence[renderSequence.length - 1] !== stage) {
    renderSequence.push(stage);
  }
}

describe('auth hydration', () => {
  let app: AppHandle | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    navigation.replace.mockReset();
    navigation.push.mockReset();
    navigation.searchParams = new URLSearchParams();
  });

  afterEach(async () => {
    if (app !== null) {
      await act(async () => {
        app?.root.unmount();
      });
      app.queryClient.clear();
      app = null;
    }
    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('keeps a stored session on the private page while /auth/me is pending', async () => {
    seedSession();
    const requests: Deferred<Response>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      if (!String(input).endsWith('/auth/me')) {
        throw new Error(`unexpected request: ${String(input)}`);
      }
      const request = deferred<Response>();
      requests.push(request);
      return request.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    app = await mountHydratedApp();
    await act(async () => {
      await waitFor(
        () => requests.length > 0,
        'the first /auth/me request',
        app!.container,
        app!.renderSequence,
      );
    });

    expect(currentStage(app.container)).toBe('checking');
    expect(
      navigation.replace,
      `render sequence: ${app.renderSequence.join(' -> ')}`,
    ).not.toHaveBeenCalled();
    expect(app.container.querySelector('[data-testid="private-content"]')).toBeNull();

    await act(async () => {
      for (const request of requests) {
        request.resolve(jsonResponse(TEST_USER));
      }
      await waitFor(
        () => app!.container.querySelector('[data-testid="private-content"]') !== null,
        'the authenticated private page',
        app!.container,
        app!.renderSequence,
      );
    });

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(app.container.querySelector('[data-testid="private-content"]')).not.toBeNull();
  });

  it('shows a recoverable error and retries session verification after a 503', async () => {
    seedSession();
    let mode: 'pending' | 'error' | 'retry-pending' | 'success' = 'pending';
    const initialRequests: Deferred<Response>[] = [];
    const retryRequests: Deferred<Response>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      if (!String(input).endsWith('/auth/me')) {
        throw new Error(`unexpected request: ${String(input)}`);
      }
      if (mode === 'error') {
        return errorResponse(503);
      }
      if (mode === 'success') {
        return jsonResponse(TEST_USER);
      }
      const request = deferred<Response>();
      if (mode === 'retry-pending') {
        retryRequests.push(request);
      } else {
        initialRequests.push(request);
      }
      return request.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    app = await mountHydratedApp();
    await act(async () => {
      await waitFor(
        () => initialRequests.length > 0,
        'the initial /auth/me request',
        app!.container,
        app!.renderSequence,
      );
      mode = 'error';
      for (const request of initialRequests) {
        request.resolve(errorResponse(503));
      }
      await waitFor(
        () => app!.container.querySelector('[role="alert"]') !== null,
        'the session verification error',
        app!.container,
        app!.renderSequence,
      );
    });

    expect(navigation.replace).not.toHaveBeenCalled();
    const retryButton = Array.from(app.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '重试',
    );
    expect(retryButton).not.toBeUndefined();

    mode = 'retry-pending';
    await act(async () => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitFor(
        () => retryRequests.length > 0,
        'the retry /auth/me request',
        app!.container,
        app!.renderSequence,
      );
      mode = 'success';
      for (const request of retryRequests) {
        request.resolve(jsonResponse(TEST_USER));
      }
      await waitFor(
        () => app!.container.querySelector('[data-testid="private-content"]') !== null,
        'the private page after retry',
        app!.container,
        app!.renderSequence,
      );
    });

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(app.container.querySelector('[data-testid="private-content"]')).not.toBeNull();
  });

  it('redirects to login after an empty stored session is resolved as anonymous', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      throw new Error(`unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    app = await mountHydratedApp();
    await act(async () => {
      await waitFor(
        () => navigation.replace.mock.calls.length > 0,
        'the login redirect',
        app!.container,
        app!.renderSequence,
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Fconsole');
    expect(app.container.querySelector('[data-testid="private-content"]')).toBeNull();
  });
});
