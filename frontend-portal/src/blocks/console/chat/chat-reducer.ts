import type { AppLocale } from '@/i18n/routing';
import type { Localized } from '@/lib/catalog';
import { CHAT_REPLIES, type ChatMessage } from '@/lib/console';

/** 回复逐字出现的节奏：每 24 毫秒多显示 2 个字，模拟流式输出 */
export const STREAM_INTERVAL_MS = 24;
export const STREAM_STEP = 2;

/** 正在输出的那条助手回复：full 是整段回复，shown 是已经显示出来的字数 */
export interface Streaming {
  id: string;
  full: string;
  shown: number;
}

export interface ChatState {
  messages: ChatMessage[];
  streaming: Streaming | null;
  /**
   * 已经发送过几条：决定下一条回复取哪一句占位回复（轮流使用），
   * 也用来给新消息编号。新对话不清零，所以编号不会重复。
   */
  replyIndex: number;
}

export type ChatAction =
  /** 发送：加一条用户消息和一条空的助手回复，随后由 tick 把回复逐字补满 */
  | { type: 'send'; text: string; model: string; locale: AppLocale }
  | { type: 'tick' }
  /** 停止：立刻结束输出，保留已经显示的部分 */
  | { type: 'stop' }
  /** 新对话：清空消息并停止正在输出的回复 */
  | { type: 'reset' };

/** 用户输入和被截断的回复没有译文，中英文两份都放同一段文字 */
const plain = (text: string): Localized => ({ zh: text, en: text });

export function createChatState(sample: readonly ChatMessage[]): ChatState {
  return { messages: [...sample], streaming: null, replyIndex: 0 };
}

/**
 * 结束当前的输出，把最终文字写回那条助手消息。
 * 一个字都还没显示就被停止时，直接去掉这条空回复，免得留下一个空气泡。
 */
function settle(state: ChatState, text: string): ChatState {
  const { streaming } = state;
  if (!streaming) return state;
  const messages =
    text === ''
      ? state.messages.filter((message) => message.id !== streaming.id)
      : state.messages.map((message) =>
          message.id === streaming.id ? { ...message, content: plain(text) } : message,
        );
  return { ...state, messages, streaming: null };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'send': {
      // 上一条还没输出完时不接新消息，避免两段回复同时输出
      if (state.streaming) return state;
      const reply = CHAT_REPLIES[state.replyIndex % CHAT_REPLIES.length]?.[action.locale] ?? '';
      const assistantId = `assistant-${state.replyIndex}`;
      return {
        messages: [
          ...state.messages,
          {
            id: `user-${state.replyIndex}`,
            role: 'user',
            content: plain(action.text),
            model: null,
          },
          { id: assistantId, role: 'assistant', content: plain(''), model: action.model },
        ],
        streaming: { id: assistantId, full: reply, shown: 0 },
        replyIndex: state.replyIndex + 1,
      };
    }
    case 'tick': {
      const { streaming } = state;
      if (!streaming) return state;
      const shown = Math.min(streaming.full.length, streaming.shown + STREAM_STEP);
      return shown >= streaming.full.length
        ? settle(state, streaming.full)
        : { ...state, streaming: { ...streaming, shown } };
    }
    case 'stop':
      return state.streaming
        ? settle(state, state.streaming.full.slice(0, state.streaming.shown))
        : state;
    case 'reset':
      return { ...state, messages: [], streaming: null };
  }
}
