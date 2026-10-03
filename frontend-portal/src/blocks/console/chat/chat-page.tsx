'use client';

import { SquarePen } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { Button } from '@/components/console/button';
import type { AppLocale } from '@/i18n/routing';
import { CHAT_MODEL_IDS, DEFAULT_CHAT_MODEL } from '@/lib/console';
import { useUrlState } from '@/lib/use-url-state';

import { ChatComposer } from './chat-composer';
import { DEFAULT_CHAT_KEY_ID } from './chat-keys';
import { ChatMessages } from './chat-messages';
import { useChatSession } from './chat-session';
import { ChatToolbar } from './chat-toolbar';

/**
 * 控制台「对话」页：选好模型和密钥，在页内试用。不调用接口，回复是固定的占位文字，逐字显示。
 * 模型存在网址的 ?model= 里，模型页的「试一试」靠它把模型带过来；
 * 换模型、换密钥都不会清空对话，之后的回复上方显示新模型名。
 */
export function ChatPage() {
  const t = useTranslations('consoleChat');
  const locale = useLocale() as AppLocale;
  const [model, setModel] = useUrlState('model', CHAT_MODEL_IDS, DEFAULT_CHAT_MODEL);
  const [keyId, setKeyId] = useState(DEFAULT_CHAT_KEY_ID);
  const chat = useChatSession();

  return (
    <ConsolePage
      id="chat"
      title={t('meta.title')}
      actions={
        <Button
          variant="secondary"
          className={CONTROL_BUTTON}
          data-new-chat
          onClick={() => chat.reset()}
        >
          <SquarePen aria-hidden />
          {t('newChat')}
        </Button>
      }
    >
      <ChatToolbar model={model} onModelChange={setModel} keyId={keyId} onKeyChange={setKeyId} />
      <section
        data-chat
        className="flex min-h-[60vh] flex-col rounded-2xl border border-border bg-card shadow-card"
      >
        <ChatMessages messages={chat.messages} streaming={chat.streaming} />
        <ChatComposer
          streaming={chat.streaming !== null}
          onSend={(text) => chat.send(text, model, locale)}
          onStop={() => chat.stop()}
        />
      </section>
    </ConsolePage>
  );
}
