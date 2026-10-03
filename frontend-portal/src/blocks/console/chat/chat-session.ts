'use client';

import { useEffect, useReducer } from 'react';

import type { AppLocale } from '@/i18n/routing';
import { CHAT_SAMPLE } from '@/lib/console';

import { STREAM_INTERVAL_MS, chatReducer, createChatState } from './chat-reducer';

/**
 * 一段对话：消息列表、正在输出的回复，以及发送、停止、新对话三个操作。
 * 回复靠定时器逐字补满；只要有一条在输出就跑定时器，
 * 输出完、停止、新对话、离开页面时都会清掉，不会留下空转的定时器。
 */
export function useChatSession() {
  const [state, dispatch] = useReducer(chatReducer, CHAT_SAMPLE, createChatState);
  const streamingId = state.streaming?.id ?? null;

  useEffect(() => {
    if (streamingId === null) return;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), STREAM_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [streamingId]);

  return {
    messages: state.messages,
    streaming: state.streaming,
    send: (text: string, model: string, locale: AppLocale) =>
      dispatch({ type: 'send', text, model, locale }),
    stop: () => dispatch({ type: 'stop' }),
    reset: () => dispatch({ type: 'reset' }),
  };
}
