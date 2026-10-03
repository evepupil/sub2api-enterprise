import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import createNextIntlPlugin from 'next-intl/plugin';

// 中英文消息由 src/i18n/request.ts 按请求的语言加载
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// 开发服务允许经 Cloudflare 隧道（dev.chaosyn.com）访问开发资源
const devOrigins = ['dev.chaosyn.com', '127.0.0.1', 'localhost'];

const nextConfig = (phase: string): NextConfig =>
  withNextIntl({
    output: 'standalone',
    reactStrictMode: true,
    // 类型检查由门禁里的 pnpm typecheck 单独执行，构建时不重复跑
    typescript: { ignoreBuildErrors: true },
    allowedDevOrigins: phase === PHASE_DEVELOPMENT_SERVER ? devOrigins : undefined,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-build',
  });

export default nextConfig;
