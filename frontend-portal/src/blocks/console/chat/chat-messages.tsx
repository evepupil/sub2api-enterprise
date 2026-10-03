'use client';

import { Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { EmptyState } from '@/components/console/empty-state';
import type { AppLocale } from '@/i18n/routing';
import type { ChatMessage } from '@/lib/console';
import { cn } from '@/lib/utils';

import { AssistantMessage, UserMessage } from './chat-message';
import type { Streaming } from './chat-reducer';

/** 离底部不超过这个距离，就认为读者还在看最新内容，新输出的文字会带着列表一起往下滚 */
const STICK_TO_END_PX = 48;

function scrollToEnd(element: HTMLElement | null) {
  if (element) element.scrollTop = element.scrollHeight;
}

/**
 * 消息列表：最高 60vh，超出后在列表内滚动。
 * 新消息出现时滚到底；回复逐字变长时，只有读者没往上翻看历史才跟着滚。
 */
export function ChatMessages({
  messages,
  streaming,
}: {
  messages: readonly ChatMessage[];
  streaming: Streaming | null;
}) {
  const t = useTranslations('consoleChat');
  const locale = useLocale() as AppLocale;
  const listRef = useRef<HTMLDivElement>(null);
  const stickToEnd = useRef(true);
  const shown = streaming?.shown ?? 0;

  useEffect(() => {
    stickToEnd.current = true;
    scrollToEnd(listRef.current);
  }, [messages.length]);

  useEffect(() => {
    if (stickToEnd.current) scrollToEnd(listRef.current);
  }, [shown]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickToEnd.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_TO_END_PX;
  };

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      aria-live="polite"
      aria-busy={streaming ? 'true' : undefined}
      className={cn(
        'max-h-[60vh] flex-1 overflow-y-auto p-5',
        messages.length === 0 ? 'flex items-center justify-center' : 'space-y-5',
      )}
    >
      {messages.length === 0 ? (
        <EmptyState id="chat" icon={Sparkles} title={t('empty')} bordered={false} />
      ) : (
        messages.map((message) => {
          if (message.role === 'user') {
            return <UserMessage key={message.id} text={message.content[locale]} />;
          }
          // 正在输出的那条：显示已经出现的部分，其余消息显示完整内容
          const live = streaming !== null && streaming.id === message.id ? streaming : null;
          return (
            <AssistantMessage
              key={message.id}
              text={live ? live.full.slice(0, live.shown) : message.content[locale]}
              model={message.model}
              streaming={live !== null}
            />
          );
        })
      )}
    </div>
  );
}
