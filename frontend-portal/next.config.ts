import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import createNextIntlPlugin from 'next-intl/plugin';

// 中英文消息由 src/i18n/request.ts 按请求的语言加载
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// 开发服务允许经 Cloudflare 隧道（dev.chaosyn.com）访问开发资源
const devOrigins = ['dev.chaosyn.com', '127.0.0.1', 'localhost'];

/**
 * 中文是默认语言、地址不带前缀：用配置里的路径改写把 /models 在内部交给 /zh/models 渲染。
 * 不用语言中间件做这件事——中间件生成的改写地址带主机名（localhost），
 * 和服务实际的主机名、经隧道或反向代理时的协议对不上，会被当成外部地址再请求一次。
 * 排除英文、已带 zh 前缀、框架资源、接口和带扩展名的文件（public 下的图片等）。
 */
export const ZH_PATH = '/:path((?!en(?:/|$)|zh(?:/|$)|_next(?:/|$)|api(?:/|$)|.*\\.[^/]+$).+)';

const nextConfig = (phase: string): NextConfig =>
  withNextIntl({
    output: 'standalone',
    reactStrictMode: true,
    // 类型检查由门禁里的 pnpm typecheck 单独执行，构建时不重复跑
    typescript: { ignoreBuildErrors: true },
    allowedDevOrigins: phase === PHASE_DEVELOPMENT_SERVER ? devOrigins : undefined,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-build',
    // 带 /zh 前缀的地址统一跳回不带前缀的地址，避免同一页面有两个网址
    async redirects() {
      return [
        { source: '/zh', destination: '/', permanent: false },
        { source: '/zh/:path*', destination: '/:path*', permanent: false },
        // 控制台没有单独的首页，进来先看用量
        { source: '/console', destination: '/console/usage', permanent: false },
        { source: '/en/console', destination: '/en/console/usage', permanent: false },
      ];
    },
    async rewrites() {
      return {
        beforeFiles: [
          { source: '/', destination: '/zh' },
          { source: ZH_PATH, destination: '/zh/:path' },
        ],
        afterFiles: [],
        fallback: [],
      };
    },
  });

export default nextConfig;
