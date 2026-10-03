'use client';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/console/button';
import { Textarea } from '@/components/ui/textarea';
import { CHAT_INPUT_MAX } from '@/lib/console';

/**
 * 输入区：多行输入框、字数、发送或停止按钮。草稿只存在这里，发送后清空。
 * Enter 发送，Shift + Enter 换行；回复输出期间不能再发，发送按钮换成停止。
 */
export function ChatComposer({
  streaming,
  onSend,
  onStop,
}: {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const t = useTranslations('consoleChat');
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = draft.trim();
    if (text === '' || streaming) return;
    onSend(text);
    setDraft('');
    // 点按钮发送后，焦点回到输入框，可以直接接着写
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // 输入法组合中（如拼音选字）按回车是在确认候选词，不能当成发送
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="border-t border-border p-4">
      <Textarea
        ref={inputRef}
        id="chat-input"
        data-chat-input
        rows={3}
        maxLength={CHAT_INPUT_MAX}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('placeholder')}
        aria-label={t('input')}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-subtle-foreground">
          {t('count', { count: draft.length, max: CHAT_INPUT_MAX })}
        </span>
        {streaming ? (
          <Button
            variant="secondary"
            data-chat-stop
            onClick={() => {
              onStop();
              // 停止按钮会换回发送按钮，把焦点交给输入框，免得键盘用户的焦点丢掉
              inputRef.current?.focus();
            }}
          >
            {t('stop')}
          </Button>
        ) : (
          <Button data-chat-send disabled={draft.trim() === ''} onClick={submit}>
            <Send aria-hidden />
            {t('send')}
          </Button>
        )}
      </div>
    </div>
  );
}
