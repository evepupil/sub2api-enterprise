import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const nextConfig = (phase: string): NextConfig => ({
  output: 'standalone',
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-build',
});

export default nextConfig;
