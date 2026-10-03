import type { BackendError } from '@/lib/server/sub2api/envelope';
import type { AuthErrorReason } from '@/lib/session/types';

/**
 * 后端错误 → 官网对浏览器暴露的错误原因。纯函数，单测锁住。
 * 浏览器只拿到归好类的原因，按原因显示中文提示；后端的英文说明只进服务端日志。
 */
const BY_BACKEND_REASON: Record<string, AuthErrorReason> = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE',
  ORGANIZATION_DISABLED: 'ORGANIZATION_DISABLED',
  TOTP_INVALID_CODE: 'TOTP_INVALID_CODE',
  TOTP_TOO_MANY_ATTEMPTS: 'TOO_MANY_REQUESTS',
};

export function authReasonFor(error: BackendError): AuthErrorReason {
  const mapped = BY_BACKEND_REASON[error.reason];
  if (mapped) return mapped;
  if (error.status === 429) return 'TOO_MANY_REQUESTS';
  if (error.status >= 500) return 'BACKEND_UNAVAILABLE';
  if (error.status === 401) return 'NOT_LOGGED_IN';
  if (error.status === 400) return 'BAD_REQUEST';
  return 'UNKNOWN';
}

/** 浏览器看到的状态码：后端 5xx 一律按 503 给，其余照搬 */
export function browserStatusFor(error: BackendError): number {
  return error.status >= 500 ? 503 : error.status;
}
