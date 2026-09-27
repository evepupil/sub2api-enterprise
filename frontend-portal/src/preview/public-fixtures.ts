import type { CatalogData, PublicSiteData, StatusData } from '../features/public/types';

/** 仅供离线外观检查；正式路由不导入此文件。 */
export const publicPreviewSite: PublicSiteData = {
  settings: {
    siteName: '模型服务',
    contactInfo: null,
    documentationUrl: null,
    registrationEnabled: false,
  },
  accountActions: [],
};

const price = (min: number, max = min) => ({ min, max });
export const publicPreviewCatalog: CatalogData = {
  models: [
    {
      id: 'gpt-5.6-sol',
      provider: 'OpenAI',
      providerKey: 'openai',
      prices: {
        input: price(5),
        cacheWrite: price(6.25),
        cacheRead: price(0.5),
        output: price(30),
      },
    },
    {
      id: 'claude-sonnet-4-6',
      provider: 'Anthropic',
      providerKey: 'anthropic',
      prices: {
        input: price(3),
        cacheWrite: price(3.75),
        cacheRead: price(0.3),
        output: price(15),
      },
    },
    {
      id: 'gemini-3.1-pro-preview',
      provider: 'Google',
      providerKey: 'google',
      prices: { input: price(2), cacheWrite: price(2), cacheRead: price(0.2), output: price(12) },
    },
    {
      id: 'gpt-5.6-luna',
      provider: 'OpenAI',
      providerKey: 'openai',
      prices: {
        input: price(0.2),
        cacheWrite: price(0.25),
        cacheRead: price(0.02),
        output: price(1.2),
      },
    },
    {
      id: 'gemini-3-flash-preview',
      provider: 'Google',
      providerKey: 'google',
      prices: { input: price(0.5), cacheWrite: null, cacheRead: price(0.05), output: price(3) },
    },
    {
      id: 'claude-sonnet-4-6-long-context-example',
      provider: 'Anthropic',
      providerKey: 'anthropic',
      prices: {
        input: price(3, 6),
        cacheWrite: price(3.75, 7.5),
        cacheRead: price(0.3, 0.6),
        output: price(15, 22.5),
      },
    },
  ],
};

export const publicPreviewStatus: StatusData = {
  level: 'degraded',
  updatedAt: '2026-09-27T01:00:00.000Z',
  availability: 99.86,
  components: [
    {
      name: '标准通道',
      groupName: '公共服务',
      level: 'operational',
      availability: 99.96,
      latencyMs: 860,
      history: Array.from({ length: 60 }, (_, i) => ({
        level: i === 21 ? 'degraded' : 'operational',
        checkedAt: new Date(Date.UTC(2026, 8, 27, 0, i)).toISOString(),
      })),
    },
    {
      name: '团队通道',
      groupName: null,
      level: 'degraded',
      availability: 99.76,
      latencyMs: 1740,
      history: Array.from({ length: 60 }, (_, i) => ({
        level: i < 5 ? 'unknown' : i > 54 ? 'degraded' : i === 31 ? 'outage' : 'operational',
        checkedAt: new Date(Date.UTC(2026, 8, 27, 0, i)).toISOString(),
      })),
    },
    {
      name: '尚无探测记录的通道示例',
      groupName: null,
      level: 'unknown',
      availability: null,
      latencyMs: null,
      history: [],
    },
  ],
};
