import { describe, expect, it, vi } from 'vitest';

import { ZH_PATH } from '../next.config';

// 只测改写规则本身，不加载 next-intl 的构建插件
vi.mock('next-intl/plugin', () => ({ default: () => (config: unknown) => config }));

/** 把 Next 的 `/:path(正则)` 写法还原成整段正则来测 */
const pattern = ZH_PATH.slice('/:path'.length);
const matches = (path: string) => new RegExp(`^/${pattern}$`).test(path);

describe('中文地址改写', () => {
  it('不带前缀的中文页面地址改写到 /zh', () => {
    for (const path of [
      '/catalog',
      '/pricing',
      '/channels',
      '/docs',
      '/login',
      '/register',
      '/no-such-page',
    ]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it('英文、已带 zh 前缀、框架资源、接口和带扩展名的文件不改写', () => {
    for (const path of [
      '/en',
      '/en/catalog',
      '/zh',
      '/zh/catalog',
      '/_next/static/chunk.js',
      '/api/health',
      '/providers/openai.svg',
      '/showcase/01-architecture.webp',
      '/favicon.ico',
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('以 en、zh 开头的普通路径仍按中文页面处理', () => {
    expect(matches('/enterprise')).toBe(true);
    expect(matches('/zhuanti')).toBe(true);
  });
});
