import { parseOrigin } from '@/features/public/settings';

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const POSITIVE_INTEGER = /^[1-9]\d*$/u;
const OAUTH_PROVIDERS = new Set(['github', 'google', 'linuxdo', 'oidc', 'wechat', 'dingtalk']);
const OAUTH_COOKIE_PREFIXES = [
  'oauth_',
  'email_oauth_',
  'linuxdo_oauth_',
  'oidc_oauth_',
  'wechat_oauth_',
  'dingtalk_oauth_',
] as const;

const GET_PATHS = new Set([
  'settings/public',
  'auth/me',
  'model-plaza',
  'user/profile',
  'keys',
  'groups/available',
  'groups/rates',
  'usage',
  'usage/stats',
  'usage/dashboard/stats',
  'usage/dashboard/trend',
  'usage/dashboard/models',
  'usage/dashboard/snapshot-v2',
  'user/totp/status',
  'user/totp/verification-method',
  'payment/config',
  'payment/checkout-info',
  'payment/limits',
  'payment/orders/my',
  'organization',
  'organization/members',
  'organization/invitations',
  'organization/default-quota',
  'organization/quota-request-policy',
  'organization/quota-requests',
  'usage/organization/members',
]);

const POST_PATHS = new Set([
  'auth/login',
  'auth/register',
  'auth/send-verify-code',
  'auth/forgot-password',
  'auth/reset-password',
  'auth/refresh',
  'auth/logout',
  'auth/validate-invitation-code',
  'auth/login/2fa',
  'auth/oauth/pending/exchange',
  'auth/oauth/pending/send-verify-code',
  'auth/oauth/pending/create-account',
  'auth/oauth/pending/bind-login',
  'keys',
  'usage/dashboard/api-keys-usage',
  'user/totp/setup',
  'user/totp/enable',
  'user/totp/disable',
  'user/totp/send-code',
  'user/totp/step-up',
  'payment/orders',
  'payment/orders/verify',
  'organization/invitations',
  'organization/members/quota-batch',
  'organization/members/spending-limit-split',
  'organization/quota-requests',
]);

const PUT_PATHS = new Set([
  'user',
  'user/password',
  'organization/default-quota',
  'organization/quota-request-policy',
]);

class RequestBodyTooLargeError extends Error {
  constructor() {
    super('portal request body exceeds the limit');
    this.name = 'RequestBodyTooLargeError';
  }
}

class RequestBodyReadError extends Error {
  constructor() {
    super('portal request body could not be read');
    this.name = 'RequestBodyReadError';
  }
}

class ResponseBodyTooLargeError extends Error {
  constructor() {
    super('portal response body exceeds the limit');
    this.name = 'ResponseBodyTooLargeError';
  }
}

class TimeoutError extends Error {
  constructor() {
    super('portal request timed out');
    this.name = 'TimeoutError';
  }
}

function isPositiveIntegerSegment(value: string | undefined): value is string {
  return value !== undefined && POSITIVE_INTEGER.test(value);
}

function hasOnlySafeSegments(pathSegments: string[]): boolean {
  return pathSegments.every(
    (segment) =>
      segment.length > 0 &&
      !segment.includes('..') &&
      !segment.includes('/') &&
      !segment.includes('\\') &&
      !segment.includes('?') &&
      !segment.includes('%'),
  );
}

function isOAuthProviderSegment(value: string | undefined): value is string {
  return value !== undefined && OAUTH_PROVIDERS.has(value);
}

function matchesMethodSpecificPath(method: string, pathSegments: string[]): boolean {
  const path = pathSegments.join('/');
  const [first, second, third, fourth, fifth] = pathSegments;

  if (method === 'GET') {
    return (
      GET_PATHS.has(path) ||
      (first === 'keys' && isPositiveIntegerSegment(second) && pathSegments.length === 2) ||
      (first === 'payment' &&
        second === 'orders' &&
        isPositiveIntegerSegment(third) &&
        pathSegments.length === 3) ||
      (first === 'user' &&
        second === 'api-keys' &&
        isPositiveIntegerSegment(third) &&
        fourth === 'usage' &&
        fifth === 'daily' &&
        pathSegments.length === 5)
    );
  }

  if (method === 'POST') {
    return (
      POST_PATHS.has(path) ||
      (first === 'organization' &&
        second === 'quota-requests' &&
        isPositiveIntegerSegment(third) &&
        pathSegments.length === 4 &&
        (fourth === 'withdraw' || fourth === 'approve' || fourth === 'reject')) ||
      (first === 'auth' &&
        second === 'passkey' &&
        third === 'login' &&
        (fourth === 'begin' || fourth === 'finish') &&
        pathSegments.length === 4) ||
      (first === 'auth' &&
        second === 'oauth' &&
        isOAuthProviderSegment(third) &&
        fourth === 'start' &&
        pathSegments.length === 4) ||
      (first === 'auth' &&
        second === 'oauth' &&
        isOAuthProviderSegment(third) &&
        (fourth === 'complete-registration' ||
          fourth === 'bind-login' ||
          fourth === 'create-account') &&
        pathSegments.length === 4) ||
      (first === 'payment' &&
        second === 'orders' &&
        isPositiveIntegerSegment(third) &&
        fourth === 'cancel' &&
        pathSegments.length === 4)
    );
  }

  if (method === 'PUT') {
    return (
      PUT_PATHS.has(path) ||
      (first === 'organization' &&
        second === 'members' &&
        isPositiveIntegerSegment(third) &&
        pathSegments.length === 4 &&
        (fourth === 'status' ||
          fourth === 'display-name' ||
          fourth === 'spending-limit' ||
          fourth === 'quota')) ||
      (first === 'keys' && isPositiveIntegerSegment(second) && pathSegments.length === 2)
    );
  }

  if (method === 'DELETE') {
    return (
      (first === 'keys' && isPositiveIntegerSegment(second) && pathSegments.length === 2) ||
      (first === 'organization' &&
        second === 'invitations' &&
        isPositiveIntegerSegment(third) &&
        pathSegments.length === 3)
    );
  }

  return false;
}

/** Return true only for customer portal routes explicitly supported by the proxy. */
export function isAllowedPortalRequest(method: string, pathSegments: string[]): boolean {
  const normalizedMethod = method.toUpperCase();
  return (
    SUPPORTED_METHODS.has(normalizedMethod) &&
    hasOnlySafeSegments(pathSegments) &&
    matchesMethodSpecificPath(normalizedMethod, pathSegments)
  );
}

function jsonResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function isWriteMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function hasAllowedOrigin(request: Request, publicOrigin: string): boolean {
  const origin = request.headers.get('origin');
  if (origin === null || origin.trim() === '') {
    return true;
  }

  return parseOrigin(origin) === publicOrigin;
}

function isJsonContentType(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase();
  return (
    mediaType !== undefined && (mediaType === 'application/json' || mediaType.endsWith('+json'))
  );
}

function isAllowedOAuthCookieName(name: string): boolean {
  return OAUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function filteredCookieHeader(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }

  const cookies = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf('=');
      return separator > 0 && isAllowedOAuthCookieName(part.slice(0, separator).trim());
    });
  return cookies.length === 0 ? null : cookies.join('; ');
}

async function readRequestBody(request: Request): Promise<Uint8Array | undefined> {
  if (request.body === null) {
    return undefined;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      total += result.value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      throw error;
    }
    throw new RequestBodyReadError();
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    return undefined;
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function timeoutValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TIMEOUT_MS;
}

export function rewriteSetCookie(value: string): string {
  return value
    .split(';')
    .map((part, index) => {
      const trimmed = part.trim();
      if (index > 0 && /^domain=/iu.test(trimmed)) {
        return null;
      }
      if (index > 0 && /^path=\/api\/v1(?:\/|$)/iu.test(trimmed)) {
        return trimmed.replace(/^path=\/api\/v1/iu, 'Path=/api/portal');
      }
      if (index > 0 && /^path=\/api\/v1$/iu.test(trimmed)) {
        return 'Path=/api/portal';
      }
      return index === 0 ? part : trimmed;
    })
    .filter((part): part is string => part !== null)
    .join('; ');
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  headers.set('cache-control', 'private, no-store');
  headers.set(
    'content-type',
    upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
  );
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append('set-cookie', rewriteSetCookie(cookie));
  }
  return headers;
}

function responseBodyForStatus(status: number, body: string): string | null {
  return status === 204 || status === 205 || status === 304 ? null : body;
}

function requestHeaders(request: Request, publicOrigin: string): Headers {
  const headers = new Headers();
  // The backend validates payment return hosts against this browser-facing origin.
  // Derive it here; never trust a caller-supplied foreign Referer.
  headers.set('referer', `${publicOrigin}/`);
  headers.set('x-forwarded-proto', new URL(publicOrigin).protocol.slice(0, -1));
  for (const name of ['authorization', 'content-type', 'user-agent', 'idempotency-key']) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  const cookie = filteredCookieHeader(request.headers.get('cookie'));
  if (cookie !== null) {
    headers.set('cookie', cookie);
  }
  return headers;
}

function upstreamPath(pathSegments: string[], request: Request): string {
  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
  const target = new URL(`/api/v1/${path}`, new URL(request.url).origin);
  target.search = new URL(request.url).search;
  return target.pathname + target.search;
}

async function readUpstreamBody(response: Response): Promise<string> {
  if (response.body === null) {
    return await response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      total += result.value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new ResponseBodyTooLargeError();
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/** Forward one allow-listed customer request to the fixed internal backend origin. */
export async function forwardPortalRequest(
  request: Request,
  pathSegments: string[],
  options: {
    baseUrl?: string;
    publicOrigin?: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (!isAllowedPortalRequest(method, pathSegments)) {
    return jsonResponse(404, '请求地址不存在');
  }
  const publicOrigin = parseOrigin(options.publicOrigin ?? new URL(request.url).origin);
  if (publicOrigin === null) return jsonResponse(503, '服务暂时不可用');
  if (isWriteMethod(method) && !hasAllowedOrigin(request, publicOrigin)) {
    return jsonResponse(403, '请求来源不被允许');
  }

  const origin = parseOrigin(options.baseUrl);
  if (origin === null) {
    return jsonResponse(503, '服务暂时不可用');
  }

  let body: Uint8Array | undefined;
  if (method !== 'GET') {
    const contentType = request.headers.get('content-type');
    if (contentType !== null && !isJsonContentType(contentType)) {
      return jsonResponse(415, '只支持 JSON 请求');
    }
    const contentLength = request.headers.get('content-length');
    if (
      contentLength !== null &&
      /^\d+$/u.test(contentLength) &&
      Number(contentLength) > MAX_REQUEST_BODY_BYTES
    ) {
      return jsonResponse(413, '请求内容过大');
    }
    try {
      body = await readRequestBody(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return jsonResponse(413, '请求内容过大');
      }
      return jsonResponse(400, '请求内容无法读取');
    }
    if (body !== undefined && !isJsonContentType(contentType)) {
      return jsonResponse(415, '只支持 JSON 请求');
    }
  }

  const controller = new AbortController();
  const callerSignal = request.signal;
  let callerAbort: (() => void) | undefined;
  let rejectCallerAbort: ((reason?: unknown) => void) | undefined;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const callerAbortPromise = new Promise<never>((_resolve, reject) => {
    rejectCallerAbort = reject;
  });
  if (callerSignal !== undefined) {
    callerAbort = (): void => {
      controller.abort(callerSignal.reason);
      rejectCallerAbort?.(
        callerSignal.reason ?? new DOMException('The operation was aborted', 'AbortError'),
      );
    };
    if (callerSignal.aborted) {
      callerAbort();
    } else {
      callerSignal.addEventListener('abort', callerAbort, { once: true });
    }
  }

  const fetcher = options.fetcher ?? fetch;
  const target = `${origin}${upstreamPath(pathSegments, request)}`;
  const bodyText = body === undefined ? undefined : new TextDecoder().decode(body);
  const init: RequestInit = {
    method,
    headers: requestHeaders(request, publicOrigin),
    cache: 'no-store',
    redirect: 'error',
    signal: controller.signal,
    ...(bodyText === undefined ? {} : { body: bodyText }),
  };

  const work = (async (): Promise<Response> => {
    if (pathSegments[0] === 'payment') {
      // The legacy payment API also serves member accounts. This portal exposes
      // balance billing only to individuals and organization owners.
      const identityResponse = await fetcher(`${origin}/api/v1/auth/me`, {
        ...init,
        method: 'GET',
        body: undefined,
      });
      if (!identityResponse.ok) {
        return jsonResponse(
          identityResponse.status === 401 ? 401 : 503,
          '无法核实当前账号的付款权限',
        );
      }
      const identity = JSON.parse(await readUpstreamBody(identityResponse)) as unknown;
      if (
        typeof identity !== 'object' ||
        identity === null ||
        !('code' in identity) ||
        identity.code !== 0 ||
        !('data' in identity) ||
        typeof identity.data !== 'object' ||
        identity.data === null ||
        !('id' in identity.data) ||
        typeof identity.data.id !== 'number' ||
        !Number.isSafeInteger(identity.data.id) ||
        identity.data.id <= 0
      ) {
        return jsonResponse(502, '无法核实当前账号的付款权限');
      }
      const organization = 'organization' in identity.data ? identity.data.organization : null;
      if (organization !== null && organization !== undefined) {
        if (
          typeof organization !== 'object' ||
          !('is_owner' in organization) ||
          organization.is_owner !== true
        ) {
          return jsonResponse(403, '组织成员使用配额，请由组织管理员充值');
        }
      }
    }
    const upstream = await fetcher(target, init);
    const text = await readUpstreamBody(upstream);
    return new Response(responseBodyForStatus(upstream.status, text), {
      status: upstream.status,
      headers: responseHeaders(upstream),
    });
  })();
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new TimeoutError());
      reject(new TimeoutError());
    }, timeoutValue(options.timeoutMs));
  });

  try {
    return await Promise.race([work, timeout, callerAbortPromise]);
  } catch (error) {
    if (callerSignal.aborted) {
      throw error;
    }
    if (timedOut || error instanceof TimeoutError) {
      return jsonResponse(504, '请求超时，请稍后重试');
    }
    if (error instanceof RequestBodyTooLargeError || error instanceof ResponseBodyTooLargeError) {
      return jsonResponse(502, '服务返回内容过大');
    }
    return jsonResponse(502, '服务暂时不可用，请稍后重试');
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (callerAbort !== undefined) {
      callerSignal.removeEventListener('abort', callerAbort);
    }
    controller.abort();
  }
}
