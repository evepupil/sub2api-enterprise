import type { NextRequest } from 'next/server';

import {
  clearedCookieWrites,
  isSecureRequest,
  sessionCookieWrites,
  tokenPairFrom,
  TWO_FACTOR_COOKIE,
} from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
} from '@/lib/server/session/session';
import { toSessionUser } from '@/lib/server/session/user';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

/** 字段长度上限：超出的直接按请求有误处理，不转给后端 */
const LIMITS = {
  email: 254,
  password: 512,
  code: 128,
  organizationName: 100,
  organizationMemberName: 50,
} as const;

function text(body: Record<string, unknown>, key: string, max: number): string | undefined | null {
  const value = body[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = key === 'password' ? value : value.trim();
  return trimmed.length > max ? null : trimmed;
}

/**
 * 注册：个人注册、创建组织、凭组织邀请码加入，都走后端同一个注册接口，由后端按邀请码类型判断。
 * 开了邮箱验证时请求里带 6 位验证码。成功后和登录一样写入凭证 cookie，直接是登录状态。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const email = text(body, 'email', LIMITS.email);
  const password = text(body, 'password', LIMITS.password);
  const verifyCode = text(body, 'verifyCode', LIMITS.code);
  const invitationCode = text(body, 'invitationCode', LIMITS.code);
  const promoCode = text(body, 'promoCode', LIMITS.code);
  const affCode = text(body, 'affCode', LIMITS.code);
  const organizationName = text(body, 'organizationName', LIMITS.organizationName);
  const organizationMemberName = text(
    body,
    'organizationMemberName',
    LIMITS.organizationMemberName,
  );
  const fields = [
    email,
    password,
    verifyCode,
    invitationCode,
    promoCode,
    affCode,
    organizationName,
    organizationMemberName,
  ];
  if (!email || !password || fields.some((value) => value === null)) {
    return authErrorResponse('BAD_REQUEST', 400);
  }

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/register',
    body: {
      email,
      password,
      verify_code: verifyCode,
      invitation_code: invitationCode,
      promo_code: promoCode,
      aff_code: affCode,
      organization_name: organizationName,
      organization_member_name: organizationMemberName,
    },
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result.ok) {
    logBackendFailure('register', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }

  const data = (
    typeof result.data === 'object' && result.data !== null ? result.data : {}
  ) as Record<string, unknown>;
  const pair = tokenPairFrom(data);
  const user = toSessionUser(data.user);
  if (!pair || !user) return authErrorResponse('BACKEND_UNAVAILABLE', 503);

  const secure = isSecureRequest(request.url, request.headers);
  return jsonResponse({ ok: true, status: 'signed_in', user }, 200, [
    ...sessionCookieWrites(pair, secure),
    ...clearedCookieWrites([TWO_FACTOR_COOKIE], secure),
  ]);
}
