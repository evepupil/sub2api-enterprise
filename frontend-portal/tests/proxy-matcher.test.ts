import { describe, expect, it, vi } from 'vitest';

import { config } from '@/proxy';

// 只测匹配串，不加载真正的语言中间件（它依赖 Next 运行时）
vi.mock('next-intl/middleware', () => ({ default: () => () => null }));

/** 按 Next 的写法把匹配串当成整段正则来测（不含路径参数，足够覆盖本项目的写法） */
const matches = (path: string) => new RegExp(`^${config.matcher}$`).test(path);

describe('语言路由的匹配范围', () => {
  it('页面地址都经过语言改写', () => {
    for (const path of [
      '/',
      '/models',
      '/pricing',
      '/groups',
      '/docs',
      '/login',
      '/en',
      '/en/pricing',
    ]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it('静态资源、带扩展名的文件和框架内部地址不经过', () => {
    for (const path of [
      '/_next/static/chunk.js',
      '/providers/openai.svg',
      '/showcase/01-architecture.webp',
      '/api/health',
      '/favicon.ico',
    ]) {
      expect(matches(path), path).toBe(false);
    }
  });

  it('改写目标 /zh 开头的地址不再进中间件，避免跳转循环；以 zh 开头的普通路径仍经过', () => {
    expect(matches('/zh')).toBe(false);
    expect(matches('/zh/models')).toBe(false);
    expect(matches('/zhuanti')).toBe(true);
  });
});
