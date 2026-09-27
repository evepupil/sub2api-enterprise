export interface ProviderIdentity {
  provider: string;
  providerKey: string;
}

interface ProviderRule {
  key: string;
  name: string;
  terms: readonly string[];
}

const MODEL_PROVIDER_RULES: readonly ProviderRule[] = [
  { key: 'anthropic', name: 'Anthropic', terms: ['claude'] },
  { key: 'openai', name: 'OpenAI', terms: ['gpt', 'chatgpt', 'o1', 'o3', 'o4'] },
  { key: 'google', name: 'Google', terms: ['gemini'] },
  { key: 'deepseek', name: 'DeepSeek', terms: ['deepseek'] },
  { key: 'qwen', name: 'Qwen', terms: ['qwen'] },
];

const PLATFORM_PROVIDER_RULES: readonly ProviderRule[] = [
  { key: 'anthropic', name: 'Anthropic', terms: ['anthropic', 'claude'] },
  { key: 'openai', name: 'OpenAI', terms: ['openai', 'azure'] },
  { key: 'google', name: 'Google', terms: ['google', 'gemini', 'vertex'] },
  { key: 'deepseek', name: 'DeepSeek', terms: ['deepseek'] },
  { key: 'qwen', name: 'Qwen', terms: ['qwen', 'alibaba', 'dashscope'] },
];

function matchesTerm(value: string, term: string): boolean {
  if (term === 'o1' || term === 'o3' || term === 'o4') {
    return new RegExp(`(?:^|[^a-z0-9])${term}(?:[^a-z0-9]|$)`, 'i').test(value);
  }

  return value.includes(term);
}

function findProvider(value: string, rules: readonly ProviderRule[]): ProviderIdentity | null {
  const normalized = value.trim().toLowerCase();
  for (const rule of rules) {
    if (rule.terms.some((term) => matchesTerm(normalized, term))) {
      return { provider: rule.name, providerKey: rule.key };
    }
  }
  return null;
}

/** 先按模型代号识别厂家，再按后端 platform 识别，未知 platform 原样保留。 */
export function identifyProvider(modelId: string, platform: string): ProviderIdentity {
  return (
    findProvider(modelId, MODEL_PROVIDER_RULES) ??
    findProvider(platform, PLATFORM_PROVIDER_RULES) ?? {
      provider: platform.trim(),
      providerKey: 'other',
    }
  );
}
