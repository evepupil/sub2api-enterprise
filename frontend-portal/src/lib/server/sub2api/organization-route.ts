import type { NextRequest, NextResponse } from 'next/server';

import type { CookieWrite } from '@/lib/server/session/cookies';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';

import { callBackend, type BackendCall } from './client';
import type { BackendError } from './envelope';
import { orgErrorFor, orgErrorStatus } from './organization';

/**
 * 组织页各个官网接口共用的收发：先看登录（改动类还只接受本站页面发起的请求），带着登录状态调一次后端，
 * 把结果转换后回 { ok: true, [字段]: 数据 }；失败回 { ok: false, error: { reason, status } }，
 * 登录失效回 401（页面跳登录页）。转换函数返回 undefined 表示后端结果看不懂。
 */

export function orgFailureResponse(
  scope: string,
  error: BackendError,
  writes: CookieWrite[],
): NextResponse {
  if (error.status === 401) return authErrorResponse('NOT_LOGGED_IN', 401, writes);
  const reason = orgErrorFor(error);
  if (reason === 'unavailable') logBackendFailure(scope, { ok: false, error });
  const status = orgErrorStatus(reason);
  return jsonResponse({ ok: false, error: { reason, status } }, status, writes);
}

interface OrgCall<T> {
  scope: string;
  method: BackendCall['method'];
  path: string;
  body?: unknown;
  /** 回给浏览器时数据放在哪个字段 */
  field: string;
  convert: (raw: unknown) => T | undefined;
}

async function run<T>(request: NextRequest, call: OrgCall<T>): Promise<NextResponse> {
  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: call.method,
      path: call.path,
      body: call.body,
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) return orgFailureResponse(call.scope, result.error, writes);
  const data = call.convert(result.data);
  if (data === undefined) {
    return jsonResponse({ ok: false, error: { reason: 'unavailable', status: 502 } }, 502, writes);
  }
  return jsonResponse({ ok: true, [call.field]: data }, 200, writes);
}

/** 读：只看登录；查询参数不合法时传 null，回 400（先看登录再看参数） */
export async function orgRead<T>(
  request: NextRequest,
  call: OrgCall<T> | null,
): Promise<NextResponse> {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (call === null) return authErrorResponse('BAD_REQUEST', 400);
  return run(request, call);
}

/** 改：看登录、只接受本站页面发起的请求；body 由调用方先校验好（不合法时传 null，回 400） */
export async function orgWrite<T>(
  request: NextRequest,
  call: OrgCall<T> | null,
): Promise<NextResponse> {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);
  if (call === null) return authErrorResponse('BAD_REQUEST', 400);
  return run(request, call);
}

/** 转换结果里允许为空（null）的情况，用这个包一层：看不懂时才是 undefined */
export const orNull =
  <T>(convert: (raw: unknown) => T | null) =>
  (raw: unknown): T | null =>
    raw === null || raw === undefined ? null : (convert(raw) ?? null);

/** 看不懂时是 undefined（回 502） */
export const strict =
  <T>(convert: (raw: unknown) => T | null) =>
  (raw: unknown): T | undefined =>
    convert(raw) ?? undefined;
