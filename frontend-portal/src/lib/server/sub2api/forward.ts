/**
 * 官网服务器替浏览器调后端时，要把这几样「请求来自谁」的信息带过去。纯函数，单测锁住。
 *
 * - 用户真实 IP：后端按 IP 做登录限流和审计。官网服务器转发时如果不带，后端会把所有用户当成同一个 IP。
 *   上游（Caddy、Cloudflare 隧道）已经写好的 X-Forwarded-For 原样转过去；没有上游时 Next 会填上直连地址。
 *   后端只认它信任的代理写的转发头，所以部署时要把官网服务器加进后端的可信代理。
 * - 浏览器标识与语言：后端审计日志和会话记录要用。
 * - 原始协议与主机：后端生成回跳地址等场景会用到。
 */
const PASS_THROUGH = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-forwarded-proto',
  'x-forwarded-host',
  'user-agent',
  'accept-language',
] as const;

export function forwardedHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  for (const name of PASS_THROUGH) {
    const value = incoming.get(name);
    if (value !== null && value.trim() !== '') headers.set(name, value);
  }
  return headers;
}
