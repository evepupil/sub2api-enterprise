'use client';

import { ACCOUNT_ERROR_REASONS, type AccountErrorReason } from './account-types';
import { sendPortalJson, type ActionResult } from './loadable';

/**
 * 账户设置页调官网接口：改用户名、改登录密码。登录失效时 sendPortalJson 会整页跳登录页。
 * 改密码成功后官网已清掉登录 cookie，页面提示后自己跳回登录页。
 */

export type AccountActionResult<T> = ActionResult<T, AccountErrorReason>;

function fallbackReason(status: number): AccountErrorReason {
  if (status === 429) return 'too_many';
  if (status === 400) return 'invalid';
  return 'unavailable';
}

/** 改用户名，成功时给后端存下的用户名 */
export function saveUsername(username: string): Promise<AccountActionResult<string>> {
  return sendPortalJson(
    '/api/portal/console/account/profile',
    'PUT',
    { username },
    (payload) => (typeof payload.username === 'string' ? payload.username : null),
    ACCOUNT_ERROR_REASONS,
    fallbackReason,
  );
}

/** 改登录密码 */
export function changePassword(current: string, next: string): Promise<AccountActionResult<true>> {
  return sendPortalJson(
    '/api/portal/console/account/password',
    'PUT',
    { current, next },
    () => true,
    ACCOUNT_ERROR_REASONS,
    fallbackReason,
  );
}
