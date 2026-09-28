import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { allowedDevelopmentHosts } from './config/development-origins.mjs';

const nextConfig = (phase: string): NextConfig => ({
  output: 'standalone',
  reactStrictMode: true,
  allowedDevOrigins:
    phase === PHASE_DEVELOPMENT_SERVER ? allowedDevelopmentHosts(process.env) : undefined,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-build',
});

export default nextConfig;
