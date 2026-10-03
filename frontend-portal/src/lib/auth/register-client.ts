import { reasonFromResponse } from '@/lib/session/client';
import type { AuthErrorReason, SessionUser } from '@/lib/session/types';

import type { CodeCheck, RegisterPayload } from './register-form';
import { fromPortalSettings, type AuthSettings } from './settings';

/**
 * 浏览器端调官网注册相关接口（/api/portal/auth/*）。返回值统一成「成功 / 失败原因」，
 * 界面按原因显示中文提示。
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function request(path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data: unknown = await response.json().catch(() => null);
    return { status: response.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

/** 读后端公开开关；读不到返回 null，界面用兜底值（和现有注册页一致） */
export async function fetchAuthSettings(): Promise<AuthSettings | null> {
  const { status, data } = await request('/api/portal/auth/settings');
  if (status !== 200 || !isRecord(data) || !isRecord(data.settings)) return null;
  return fromPortalSettings(data.settings);
}

/** 校验邀请码；网络或后端出错时按「无效」处理（和现有注册页一致） */
export async function checkInvitationCode(code: string): Promise<CodeCheck> {
  const { status, data } = await request('/api/portal/auth/validate-invitation-code', { code });
  if (status === 200 && isRecord(data)) {
    if (data.valid === true) {
      return { status: 'valid', kind: data.type === 'organization' ? 'organization' : 'platform' };
    }
    return {
      status: 'invalid',
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : '',
    };
  }
  return { status: 'invalid', errorCode: '' };
}

/** 校验优惠码；有效时带回赠送余额 */
export async function checkPromoCode(code: string): Promise<CodeCheck> {
  const { status, data } = await request('/api/portal/auth/validate-promo-code', { code });
  if (status === 200 && isRecord(data)) {
    if (data.valid === true) {
      return {
        status: 'valid',
        bonusAmount: typeof data.bonusAmount === 'number' ? data.bonusAmount : 0,
      };
    }
    return {
      status: 'invalid',
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : '',
    };
  }
  return { status: 'invalid', errorCode: '' };
}

export type SendCodeResult =
  { ok: true; countdown: number } | { ok: false; reason: AuthErrorReason };

export async function sendVerifyCode(email: string): Promise<SendCodeResult> {
  const { status, data } = await request('/api/portal/auth/send-verify-code', { email });
  if (status === 200 && isRecord(data) && data.ok === true) {
    return { ok: true, countdown: typeof data.countdown === 'number' ? data.countdown : 60 };
  }
  return { ok: false, reason: reasonFromResponse(status, data) };
}

export type RegisterResult =
  { kind: 'signed_in'; user: SessionUser } | { kind: 'error'; reason: AuthErrorReason };

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  const { status, data } = await request('/api/portal/auth/register', payload);
  if (status === 200 && isRecord(data) && data.ok === true && isRecord(data.user)) {
    return { kind: 'signed_in', user: data.user as unknown as SessionUser };
  }
  return { kind: 'error', reason: reasonFromResponse(status, data) };
}
