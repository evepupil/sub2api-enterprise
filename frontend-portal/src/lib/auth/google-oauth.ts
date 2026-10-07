import { reasonFromResponse } from '@/lib/session/client';
import type { AuthErrorReason } from '@/lib/session/types';

import { authRequest } from './register-client';

/**
 * 谷歌登录在浏览器这一侧：拼发起地址、注册页的草稿、完成注册页调的两个官网接口。
 * 令牌不经过页面脚本：发起、回调都是整页跳转到官网服务器（src/app/api/portal/auth/oauth/google/），
 * 由服务器替浏览器和后台打交道，登录凭证直接写进页面读不到的 cookie。
 */

export const GOOGLE_START_PATH = '/api/portal/auth/oauth/google/start';

export interface GoogleStartOptions {
  locale: 'zh' | 'en';
  /** 登录后去的控制台地址（登录页的 ?next=） */
  next?: string;
  invitationCode?: string;
  organizationName?: string;
  memberName?: string;
  aff?: string;
  promo?: string;
}

/** 「使用 Google 账号登录 / 注册」要整页跳去的地址 */
export function googleStartUrl(options: GoogleStartOptions): string {
  const query = new URLSearchParams({ locale: options.locale });
  const add = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) query.set(key, trimmed);
  };
  add('next', options.next);
  add('invitation_code', options.invitationCode);
  add('organization_name', options.organizationName);
  add('member_name', options.memberName);
  add('aff', options.aff);
  add('promo', options.promo);
  return `${GOOGLE_START_PATH}?${query.toString()}`;
}

/** 注册页点「使用 Google 账号注册」前，把已经填好的存下来，完成注册页打开时预填 */
export interface GoogleRegisterDraft {
  account: 'personal' | 'organization';
  orgName: string;
  memberName: string;
  invite: string;
  aff: string;
}

const DRAFT_KEY = 'portal_google_register_draft';

export function storeGoogleDraft(draft: GoogleRegisterDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 浏览器禁用存储时不预填，不影响注册
  }
}

export function loadGoogleDraft(): GoogleRegisterDraft | null {
  try {
    const raw: unknown = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const record = raw as Record<string, unknown>;
    const text = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : '');
    return {
      account: record.account === 'organization' ? 'organization' : 'personal',
      orgName: text('orgName'),
      memberName: text('memberName'),
      invite: text('invite'),
      aff: text('aff'),
    };
  } catch {
    return null;
  }
}

export function clearGoogleDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 同上
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type GooglePendingResult =
  { ok: true; email: string; invitationRequired: boolean } | { ok: false; reason: AuthErrorReason };

/** 完成注册页打开时：读谷歌邮箱、是否必须填邀请码 */
export async function fetchGooglePending(): Promise<GooglePendingResult> {
  const { status, data } = await authRequest('/api/portal/auth/oauth/google/pending', {});
  if (status === 200 && isRecord(data) && data.ok === true && typeof data.email === 'string') {
    return { ok: true, email: data.email, invitationRequired: data.invitationRequired === true };
  }
  return { ok: false, reason: reasonFromResponse(status, data) };
}

export interface GoogleCompletePayload {
  password: string;
  invitationCode?: string;
  organizationName?: string;
  organizationMemberName?: string;
  affCode?: string;
}

export type GoogleCompleteResult = { ok: true } | { ok: false; reason: AuthErrorReason };

/** 完成注册：成功即为登录状态 */
export async function completeGoogleRegistration(
  payload: GoogleCompletePayload,
): Promise<GoogleCompleteResult> {
  const { status, data } = await authRequest('/api/portal/auth/oauth/google/complete', payload);
  if (status === 200 && isRecord(data) && data.ok === true) return { ok: true };
  return { ok: false, reason: reasonFromResponse(status, data) };
}
