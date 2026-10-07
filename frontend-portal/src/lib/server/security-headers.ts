/**
 * 全站响应头（next.config.ts 的 headers() 对所有地址生效）。单测锁住，改动要同步文档。
 * - 不许别的网站用框架嵌入本站（防点击劫持）：CSP 的 frame-ancestors，旧浏览器认 X-Frame-Options；
 * - CSP 只收紧不影响功能的几项（框架嵌入、<base>、插件、表单提交目标），脚本、样式、图片、
 *   Cloudflare 人机验证的框架都不限制；
 * - 禁止浏览器猜文件类型；跳到外站时只带域名、不带完整网址；关掉用不到的摄像头、麦克风、定位；
 * - 强制 HTTPS 一年：浏览器只在 HTTPS 下认这个头；不带子域名，旧管理后台另绑域名不受影响。
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];
