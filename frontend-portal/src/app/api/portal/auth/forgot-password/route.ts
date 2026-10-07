import type { NextRequest } from 'next/server';

import { resetEmailError } from '@/lib/auth/password-reset';
import { captchaTokenFrom, withCaptcha } from '@/lib/server/session/captcha';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
} from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

/** 邮件语言：后端按 Accept-Language 选中文或英文模板，这里换成页面的语言 */
const EMAIL_LANGUAGE: Record<string, string> = { zh: 'zh-CN', en: 'en' };

/**
 * 找回密码：POST { email, locale, captchaToken? }，请后端给这个邮箱发重置链接（后台开了人机验证时要带验证结果）。
 * 只接受本站页面发起的请求；不管邮箱有没有注册，后端都回成功（防止被拿来试探谁注册过）。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const captchaToken = captchaTokenFrom(body);
  if (resetEmailError(email) !== null || captchaToken === null) {
    return authErrorResponse('BAD_REQUEST', 400);
  }

  const forwarded = forwardedHeaders(request.headers);
  const language = typeof body.locale === 'string' ? EMAIL_LANGUAGE[body.locale] : undefined;
  if (language) forwarded.set('accept-language', language);

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/forgot-password',
    body: withCaptcha({ email }, captchaToken),
    forwarded,
  });
  if (!result.ok) {
    logBackendFailure('forgot-password', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }
  return jsonResponse({ ok: true }, 200);
}
