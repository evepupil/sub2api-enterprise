import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

describe('全站安全响应头', () => {
  it('所有地址都带上：防嵌入、禁止猜类型、来源策略、设备权限、强制 HTTPS，且不暴露框架名', async () => {
    const config = nextConfig('phase-production-build');
    expect(config.poweredByHeader).toBe(false);
    const rules = (await config.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe('/:path*');
    const headers = new Map(rules[0]?.headers.map((header) => [header.key, header.value]));
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
  });

  it('CSP 不限制脚本和框架来源（Cloudflare 人机验证要加载外部脚本和框架）', async () => {
    const rules = (await nextConfig('phase-production-build').headers?.()) ?? [];
    const csp = rules[0]?.headers.find((header) => header.key === 'Content-Security-Policy');
    expect(csp?.value).not.toMatch(/script-src|default-src|frame-src/);
  });
});
