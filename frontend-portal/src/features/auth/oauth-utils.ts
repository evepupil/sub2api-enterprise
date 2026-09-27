import type { ApiRequestOptions } from './types';

export const OAUTH_NEXT_STORAGE_KEY = 'sub2api.portal.auth.oauth-next.v1';
export const OAUTH_PROVIDER_STORAGE_KEY = 'sub2api.portal.auth.oauth-provider.v1';

const LOCAL_ORIGIN = 'https://portal.invalid';

export function safeReturnPath(value: string | null | undefined, fallback = '/console'): string {
  if (typeof value !== 'string' || value.length === 0 || !value.startsWith('/')) {
    return fallback;
  }
  if (value.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(value)) {
    return fallback;
  }

  let decoded: string;
  let parsed: URL;
  try {
    decoded = decodeURIComponent(value);
    parsed = new URL(value, LOCAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(decoded) ||
    parsed.origin !== LOCAL_ORIGIN ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Map legacy backend destinations to the portal's local console routes. */
export function safeOAuthRedirect(value: string | null | undefined, fallback = '/console'): string {
  const safe = safeReturnPath(value, fallback);
  const match = /^([^?#]*)([?#].*)?$/u.exec(safe);
  const pathname = match?.[1] ?? fallback;
  const suffix = match?.[2] ?? '';
  const mapped: Record<string, string> = {
    '/dashboard': '/console',
    '/keys': '/console/keys',
    '/usage': '/console/usage',
    '/profile': '/console/settings',
    '/payment': '/console/billing',
  };
  if (mapped[pathname] !== undefined) {
    return `${mapped[pathname]}${suffix}`;
  }
  if (pathname === '/console' || pathname.startsWith('/console/')) {
    return safe;
  }
  return fallback;
}

export function readSavedNextPath(fallback = '/console'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.sessionStorage.getItem(OAUTH_NEXT_STORAGE_KEY);
    window.sessionStorage.removeItem(OAUTH_NEXT_STORAGE_KEY);
    return safeReturnPath(saved, fallback);
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function accessTokenFrom(value: Record<string, unknown>): string | null {
  const token = value.access_token ?? value.accessToken;
  return typeof token === 'string' && token.trim() !== '' ? token : null;
}

/** Add the current user to token-only OAuth responses before the session manager validates them. */
export async function acceptOAuthLogin(
  request: (path: string, options?: ApiRequestOptions) => Promise<unknown>,
  acceptLogin: (value: unknown) => Promise<void>,
  value: unknown,
  expectedIdentityKey: string,
  currentIdentityKey: () => string,
): Promise<void> {
  if (!isRecord(value)) {
    throw new Error('第三方登录响应格式不正确');
  }
  const accessToken = accessTokenFrom(value);
  if (accessToken === null) {
    throw new Error('第三方登录响应缺少登录凭证');
  }
  if (currentIdentityKey() !== expectedIdentityKey) {
    throw new Error('当前登录身份已变化，已忽略迟到的认证结果');
  }

  let loginValue: Record<string, unknown> = value;
  if (!isRecord(value.user)) {
    const user = await request('/auth/me', {
      method: 'GET',
      auth: false,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (currentIdentityKey() !== expectedIdentityKey) {
      throw new Error('当前登录身份已变化，已忽略迟到的认证结果');
    }
    loginValue = { ...value, user };
  }

  if (currentIdentityKey() !== expectedIdentityKey) {
    throw new Error('当前登录身份已变化，已忽略迟到的认证结果');
  }
  await acceptLogin(loginValue);
}

export function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message.trim() !== '') return value.message;
  if (isRecord(value) && typeof value.message === 'string' && value.message.trim() !== '') {
    return value.message;
  }
  return fallback;
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
