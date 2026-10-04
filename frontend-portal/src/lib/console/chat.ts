import { MODELS, type Localized } from '@/lib/catalog';

/**
 * 对话页（占位）：一段示例对话，以及发送新消息后轮流使用的固定回复。
 * 不调用接口，回复按字逐步显示，模拟流式输出。
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: Localized;
  /** 回复用的模型 */
  model: string | null;
}

/** 对话可选的模型：全部文本模型 */
export const CHAT_MODEL_IDS: readonly string[] = MODELS.filter((m) => m.type === 'text').map(
  (m) => m.id,
);

export const DEFAULT_CHAT_MODEL = 'claude-sonnet-5-5';

export const CHAT_SAMPLE: readonly ChatMessage[] = [
  {
    id: 'c-1',
    role: 'user',
    content: {
      zh: '用三句话解释分组是怎么计费的。',
      en: 'Explain how groups are billed in three sentences.',
    },
    model: null,
  },
  {
    id: 'c-2',
    role: 'assistant',
    content: {
      zh: '每个 API 密钥都绑定一个分组，分共享、专用和企业三种。实际扣费等于模型的官方价乘以分组倍率，比如共享分组倍率 0.15，就是官方价的 15%。倍率越高的分组，资源越好，可用率承诺也越高。',
      en: 'Every API key is bound to a group: Shared, Dedicated or Enterprise. The billed price is the official price times the group ratio, so Shared at 0.15 costs 15% of the official price. Groups with higher ratios get better capacity and availability targets.',
    },
    model: 'claude-sonnet-5-5',
  },
];

/** 新消息的占位回复，按发送次数轮流使用 */
export const CHAT_REPLIES: readonly Localized[] = [
  {
    zh: '这是一个占位回复：控制台的对话页暂时不调用接口。接入后，这里会按所选模型和密钥实时返回结果，并在日志里记一条请求。',
    en: 'This is a placeholder reply: the console chat does not call the API yet. Once connected, replies will stream from the selected model and key and show up in your logs.',
  },
  {
    zh: '好的。换个模型只需要改调用名，密钥和代码都不用动；不同模型的价格按你所用分组的倍率计算。',
    en: 'Sure. Switching models only changes the model name; keys and code stay the same, and prices follow your group ratio.',
  },
];

/** 输入框最多字数 */
export const CHAT_INPUT_MAX = 4000;
