'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CopyButton } from '@/components/console/copy-button';

/** 用户的消息：靠右的深色气泡。role="group" 加名字，读屏软件能听出是谁说的。 */
export function UserMessage({ text }: { text: string }) {
  const t = useTranslations('consoleChat');
  return (
    <div role="group" aria-label={t('you')} data-chat-message="user" className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {text}
      </div>
    </div>
  );
}

/**
 * 助手的回复：左侧小头像，上方一行模型调用名（换了模型后新回复显示新名字），
 * 下面是回复气泡。输出中末尾跟一个闪烁的光标块；输出完后鼠标移上去才出现复制按钮。
 */
export function AssistantMessage({
  text,
  model,
  streaming,
}: {
  text: string;
  model: string | null;
  streaming: boolean;
}) {
  const t = useTranslations('consoleChat');
  return (
    <div
      role="group"
      aria-label={model ?? undefined}
      data-chat-message="assistant"
      className="group/message flex items-start gap-3"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
      >
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 max-w-[80%]">
        {model ? (
          <p className="truncate font-mono text-xs text-subtle-foreground">{model}</p>
        ) : null}
        <div className="relative mt-1">
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-foreground">
            {text}
            {streaming ? (
              <span
                aria-hidden
                className="inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle motion-reduce:animate-none"
              />
            ) : null}
          </div>
          {/* 触屏没有悬停，按钮常显；键盘聚焦到它时也要看得见 */}
          {!streaming && text !== '' ? (
            <CopyButton
              name="chat-copy"
              value={text}
              label={t('copy')}
              className="absolute -bottom-3.5 right-3 size-7 border border-border bg-card opacity-0 shadow-card transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100 [@media(hover:none)]:opacity-100"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
