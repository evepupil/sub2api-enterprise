import { parseOrigin } from '@/features/public/settings';
import { filteredCookieHeader, rewriteSetCookie } from './portal-proxy';

const PROVIDERS = new Set(['github', 'google', 'linuxdo', 'wechat', 'dingtalk', 'oidc']);
const CALLBACK_PATH = /^\/auth\/(?:(?:oauth|linuxdo|wechat|dingtalk|oidc)\/)?callback$/;

function failure(status: number): Response {
  return Response.json(
    { code: status, message: '第三方登录未完成，请返回登录页重试' },
    {
      status,
      headers: { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' },
    },
  );
}

/** Keep provider state and pending-session cookies on the public portal host. */
export async function forwardOAuthCallback(
  request: Request,
  provider: string,
  options: {
    baseUrl?: string;
    publicOrigin?: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  if (request.method !== 'GET' || !PROVIDERS.has(provider)) return failure(404);
  const base = parseOrigin(options.baseUrl);
  const publicOrigin = parseOrigin(options.publicOrigin ?? new URL(request.url).origin);
  if (!base || !publicOrigin) return failure(503);
  const target = new URL(`/api/v1/auth/oauth/${provider}/callback`, base);
  target.search = new URL(request.url).search;
  const headers = new Headers({
    referer: `${publicOrigin}/`,
    'x-forwarded-proto': new URL(publicOrigin).protocol.slice(0, -1),
  });
  const cookies = filteredCookieHeader(request.headers.get('cookie'));
  if (cookies) headers.set('cookie', cookies);
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  try {
    const result = await (options.fetcher ?? fetch)(target, {
      method: 'GET',
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, timeout]),
    });
    const location = result.headers.get('location');
    if (![301, 302, 303, 307, 308].includes(result.status) || !location) return failure(502);
    const destination = new URL(location, publicOrigin);
    if (
      ![publicOrigin, base].includes(destination.origin) ||
      destination.username ||
      destination.password ||
      !CALLBACK_PATH.test(destination.pathname)
    )
      return failure(502);
    const publicDestination = new URL(
      `${destination.pathname}${destination.search}${destination.hash}`,
      publicOrigin,
    );
    const responseHeaders = new Headers({
      location: publicDestination.toString(),
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
    });
    for (const cookie of result.headers.getSetCookie())
      responseHeaders.append('set-cookie', rewriteSetCookie(cookie));
    return new Response(null, { status: 303, headers: responseHeaders });
  } catch {
    return failure(timeout.aborted ? 504 : 502);
  }
}
