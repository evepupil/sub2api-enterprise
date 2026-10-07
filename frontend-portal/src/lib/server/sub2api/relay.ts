import { backendOrigin, BACKEND_TIMEOUT_MS, type BackendClientOptions } from './client';

/**
 * 替浏览器把一次请求转给后端，并把后端的回应原样交回来（谷歌登录用，只在服务端）。
 *
 * 和 callBackend 的区别：后端的谷歌登录接口靠 cookie 记状态、用 302 跳转交结果，有几个接口还回
 * 不带 { code, data } 外壳的裸 JSON，所以这里要能带 cookie 过去、不跟随跳转、读出跳转地址与后端设的 cookie，
 * 响应体解析成 JSON 原样给调用方判断。连不上后端或没配置后端地址时返回 null。
 */

export interface RelayCall {
  method: 'GET' | 'POST';
  /** 后端 /api/v1 之后的路径，如 /auth/oauth/google/start */
  path: string;
  /** 查询串（不带 ?） */
  query?: string;
  body?: unknown;
  /** 要带给后端的 cookie（名字 → 值） */
  cookies?: Readonly<Record<string, string>>;
  /** 用户真实 IP、浏览器标识等，见 forwardedHeaders */
  forwarded: Headers;
}

/** 后端设的一条 cookie；cleared 表示后端在清掉它 */
export interface RelaySetCookie {
  name: string;
  value: string;
  cleared: boolean;
}

export interface RelayResponse {
  status: number;
  /** 3xx 跳转地址；没有时为 null */
  location: string | null;
  setCookies: RelaySetCookie[];
  /** 响应体按 JSON 解析的结果；不是 JSON 时为 undefined */
  body: unknown;
}

/** 解析一条 Set-Cookie：只取名字、值，以及是否在清除（Max-Age 不大于 0，或过期时间早于现在） */
export function parseSetCookie(header: string, now = Date.now()): RelaySetCookie | null {
  const [pair, ...attributes] = header.split(';');
  if (!pair) return null;
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (name === '') return null;
  let cleared = value === '';
  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split('=');
    const key = rawKey?.trim().toLowerCase();
    const attrValue = rest.join('=').trim();
    if (key === 'max-age' && Number(attrValue) <= 0) cleared = true;
    if (key === 'expires') {
      const at = Date.parse(attrValue);
      if (!Number.isNaN(at) && at <= now) cleared = true;
    }
  }
  return { name, value, cleared };
}

function cookieHeader(cookies: Readonly<Record<string, string>>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export async function relayBackend(
  call: RelayCall,
  options: BackendClientOptions = {},
): Promise<RelayResponse | null> {
  const origin = options.origin === undefined ? backendOrigin() : options.origin;
  if (origin === null) return null;

  const headers = new Headers(call.forwarded);
  headers.set('accept', 'application/json');
  if (call.body !== undefined) headers.set('content-type', 'application/json');
  if (call.cookies && Object.keys(call.cookies).length > 0) {
    headers.set('cookie', cookieHeader(call.cookies));
  }

  let response: Response;
  try {
    const query = call.query ? `?${call.query}` : '';
    response = await (options.fetchImpl ?? fetch)(`${origin}/api/v1${call.path}${query}`, {
      method: call.method,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? BACKEND_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  const setCookies = response.headers
    .getSetCookie()
    .map((header) => parseSetCookie(header))
    .filter((cookie): cookie is RelaySetCookie => cookie !== null);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { status: response.status, location: response.headers.get('location'), setCookies, body };
}
