import type { Provider, ProviderId } from './types';

/** 模型厂商，顺序即筛选栏与价目表的分组顺序 */
export const PROVIDERS: readonly Provider[] = [
  { id: 'openai', name: 'OpenAI', logo: '/providers/openai.svg', mono: true },
  { id: 'anthropic', name: 'Anthropic', logo: '/providers/claude-color.svg', mono: false },
  { id: 'google', name: 'Google', logo: '/providers/gemini-color.svg', mono: false },
  { id: 'deepseek', name: 'DeepSeek', logo: '/providers/deepseek-color.svg', mono: false },
  { id: 'moonshot', name: 'Moonshot AI', logo: '/providers/moonshot.svg', mono: true },
  { id: 'zhipu', name: 'Zhipu AI', logo: '/providers/zhipu-color.svg', mono: false },
  { id: 'minimax', name: 'MiniMax', logo: '/providers/minimax-color.svg', mono: false },
  { id: 'qwen', name: 'Qwen', logo: '/providers/qwen-color.svg', mono: false },
];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: ProviderId): Provider {
  const provider = BY_ID.get(id);
  if (!provider) throw new Error(`unknown provider: ${id}`);
  return provider;
}
