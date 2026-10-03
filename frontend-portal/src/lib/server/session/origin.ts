/**
 * 防跨站提交：会改变登录状态的请求（登录、两步验证、退出）只接受从官网自己页面发起的。
 * 浏览器发跨站请求时会带上 Origin 头，和本站主机对不上就拒绝。纯函数，单测锁住。
 *
 * 本站主机优先取反向代理或隧道写的 X-Forwarded-Host，其次是 Host。没有 Origin 头的请求
 * （服务端脚本、curl）放行：它们拿不到用户浏览器里的 cookie，借不到登录状态。
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (origin === null || origin.trim() === '' || origin === 'null') return origin === null;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
  const host = headers.get('host')?.trim().toLowerCase();
  return originHost === forwardedHost || originHost === host;
}

/**
 * 用户浏览器看到的本站地址（协议 + 主机）。服务端跳转要写完整地址，而经反向代理或隧道访问时，
 * 官网服务器自己看到的是内网地址（如 http://127.0.0.1:3000），所以优先取代理写的
 * X-Forwarded-Proto / X-Forwarded-Host，其次是 Host 头，最后才是请求地址本身。
 */
export function publicOriginFor(url: string, headers: Headers): string {
  const parsed = new URL(url);
  const proto =
    headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() ||
    parsed.protocol.replace(/:$/, '');
  const host =
    headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headers.get('host')?.trim() ||
    parsed.host;
  return `${proto}://${host}`;
}
