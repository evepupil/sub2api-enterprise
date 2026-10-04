import { backendError, parseEnvelope, PORTAL_REASONS, type BackendResult } from './envelope';

/**
 * 官网服务器调后端（sub2api）的唯一入口，只在服务端使用。
 *
 * 浏览器从不直接访问后端：后端默认拒绝别的网站从浏览器发来的请求，登录凭证也只放在页面读不到的
 * cookie 里，由这里加到请求头上。后端地址取环境变量 SUB2API_INTERNAL_URL（只填协议加主机加端口，
 * 可以是内网地址）；开发环境没配时默认本机测试后端 http://127.0.0.1:8080。
 */

const DEV_DEFAULT_ORIGIN = 'http://127.0.0.1:8080';

/** 调后端的超时，毫秒 */
export const BACKEND_TIMEOUT_MS = 15_000;

/** 后端地址；生产环境没配置时返回 null，调用方按「服务不可用」处理 */
export function backendOrigin(): string | null {
  const configured = process.env.SUB2API_INTERNAL_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production' ? null : DEV_DEFAULT_ORIGIN;
}

export interface BackendCall {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 后端 /api/v1 之后的路径，如 /auth/login */
  path: string;
  /** JSON 请求体 */
  body?: unknown;
  /** 访问凭证；有就加 Authorization 头 */
  accessToken?: string;
  /** 要带给后端的请求来源信息（真实 IP、浏览器标识等），见 forwardedHeaders */
  forwarded: Headers;
}

export interface BackendClientOptions {
  /** 测试时注入假的 fetch */
  fetchImpl?: typeof fetch;
  origin?: string | null;
  timeoutMs?: number;
}

export async function callBackend<T>(
  call: BackendCall,
  options: BackendClientOptions = {},
): Promise<BackendResult<T>> {
  const origin = options.origin === undefined ? backendOrigin() : options.origin;
  if (origin === null) {
    return { ok: false, error: backendError(503, PORTAL_REASONS.notConfigured) };
  }

  const headers = new Headers(call.forwarded);
  headers.set('accept', 'application/json');
  if (call.body !== undefined) headers.set('content-type', 'application/json');
  if (call.accessToken) headers.set('authorization', `Bearer ${call.accessToken}`);

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(`${origin}/api/v1${call.path}`, {
      method: call.method,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: backendError(503, PORTAL_REASONS.unavailable, message) };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return parseEnvelope<T>(response.status, body);
}
