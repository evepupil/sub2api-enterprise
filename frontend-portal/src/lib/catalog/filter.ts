import type { ModelType, Protocol } from './types';

/**
 * 模型筛选的选项与协议展示名。官网模型页的筛选排序见 ./live（按后台数据），控制台模型页见 src/lib/console/live/models-view.ts。
 */

export type TypeFilter = 'all' | ModelType;
export type ContextFilter = 'all' | '200k' | '1m';
export type SortKey = 'latest' | 'price-asc' | 'price-desc' | 'context';

export const TYPE_FILTERS: readonly TypeFilter[] = ['all', 'text', 'image'];
export const CONTEXT_FILTERS: readonly ContextFilter[] = ['all', '200k', '1m'];
export const SORT_KEYS: readonly SortKey[] = ['latest', 'price-asc', 'price-desc', 'context'];
export const PROTOCOLS: readonly Protocol[] = [
  'openai-chat',
  'openai-responses',
  'anthropic-messages',
  'gemini',
  'openai-images',
];

/** 协议的展示名，不随语言变化 */
export const PROTOCOL_LABELS: Record<Protocol, string> = {
  'openai-chat': 'OpenAI Chat',
  'openai-responses': 'OpenAI Responses',
  'anthropic-messages': 'Anthropic Messages',
  gemini: 'Gemini API',
  'openai-images': 'OpenAI Images',
};
