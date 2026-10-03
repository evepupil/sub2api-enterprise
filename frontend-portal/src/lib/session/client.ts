import { isAuthErrorReason, type AuthErrorReason, type SessionUser } from './types';

/**
 * 浏览器端调官网登录接口（/api/portal/auth/*）。凭证在 cookie 里由浏览器自动带上，这里只处理结果。
 * 返回值统一成「成功 / 要两步验证 / 失败原因」，界面按原因显示提示，不出现后端英文说明。
 */

export type LoginResult =
  | { kind: 'signed_in'; user: SessionUser }
  | { kind: 'requires_2fa'; emailMasked: string }
  | { kind: 'error'; reason: AuthErrorReason };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 官网接口返回的错误原因；读不出来时按状态码兜底。纯函数，单测锁住 */
export function reasonFromResponse(status: number, body: unknown): AuthErrorReason {
  if (isRecord(body) && isRecord(body.error) && isAuthErrorReason(body.error.reason)) {
    return body.error.reason;
  }
  if (status === 429) return 'TOO_MANY_REQUESTS';
  if (status === 401) return 'NOT_LOGGED_IN';
  if (status >= 500 || status === 0) return 'BACKEND_UNAVAILABLE';
  return 'UNKNOWN';
}

async function post(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data: unknown = await response.json().catch(() => null);
    return { status: response.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

function toLoginResult(status: number, data: unknown): LoginResult {
  if (status === 200 && isRecord(data) && data.ok === true) {
    if (data.status === 'requires_2fa') {
      return {
        kind: 'requires_2fa',
        emailMasked: typeof data.emailMasked === 'string' ? data.emailMasked : '',
      };
    }
    if (data.status === 'signed_in' && isRecord(data.user)) {
      return { kind: 'signed_in', user: data.user as unknown as SessionUser };
    }
  }
  return { kind: 'error', reason: reasonFromResponse(status, data) };
}

export async function signIn(email: string, password: string): Promise<LoginResult> {
  const { status, data } = await post('/api/portal/auth/login', { email, password });
  return toLoginResult(status, data);
}

export async function submitTwoFactorCode(code: string): Promise<LoginResult> {
  const { status, data } = await post('/api/portal/auth/login/2fa', { code });
  return toLoginResult(status, data);
}

export async function signOut(): Promise<void> {
  await post('/api/portal/auth/logout', {});
}

export type CurrentUserResult =
  | { kind: 'user'; user: SessionUser }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: AuthErrorReason };

export async function fetchCurrentUser(): Promise<CurrentUserResult> {
  try {
    const response = await fetch('/api/portal/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok && isRecord(data) && isRecord(data.user)) {
      return { kind: 'user', user: data.user as unknown as SessionUser };
    }
    if (response.status === 401) return { kind: 'signed_out' };
    return { kind: 'error', reason: reasonFromResponse(response.status, data) };
  } catch {
    return { kind: 'error', reason: 'BACKEND_UNAVAILABLE' };
  }
}
