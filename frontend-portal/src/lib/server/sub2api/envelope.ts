/**
 * 解析后端（sub2api）的响应格式。纯函数，不发请求，单测锁住。
 *
 * 后端成功时返回 `{ code: 0, message, data }`；出错时 HTTP 状态码即错误类别，
 * 响应体为 `{ code, message, reason?, metadata? }`，reason 是稳定的错误代码（如 INVALID_CREDENTIALS），
 * message 是给开发者看的英文说明，不展示给用户。
 */

export interface BackendError {
  /** HTTP 状态码；连不上后端、超时等记为 503，后端返回了看不懂的内容记为 502 */
  status: number;
  /** 后端的错误代码；后端没给时为空串。官网自己判定的错误用 PORTAL_ 前缀 */
  reason: string;
  /** 后端的英文说明，只用于服务端日志 */
  message: string;
}

export type BackendResult<T> = { ok: true; data: T } | { ok: false; error: BackendError };

/** 官网自己判定的错误代码 */
export const PORTAL_REASONS = {
  unavailable: 'PORTAL_BACKEND_UNAVAILABLE',
  notConfigured: 'PORTAL_BACKEND_NOT_CONFIGURED',
  badResponse: 'PORTAL_BAD_RESPONSE',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function backendError(status: number, reason: string, message = ''): BackendError {
  return { status, reason, message };
}

/** 把一次后端响应（状态码 + 已解析的 JSON，解析失败传 undefined）归一成成功或错误 */
export function parseEnvelope<T>(status: number, body: unknown): BackendResult<T> {
  if (!isRecord(body)) {
    return {
      ok: false,
      error: backendError(status >= 400 ? status : 502, PORTAL_REASONS.badResponse),
    };
  }
  if (status >= 200 && status < 300) {
    if (body.code === 0) return { ok: true, data: body.data as T };
    // 成功状态码里带了非 0 的 code：按 code 当错误类别（后端约定 code 与 HTTP 状态码一致）
    const code = typeof body.code === 'number' && body.code >= 400 ? body.code : 502;
    return { ok: false, error: backendError(code, text(body.reason), text(body.message)) };
  }
  return { ok: false, error: backendError(status, text(body.reason), text(body.message)) };
}
