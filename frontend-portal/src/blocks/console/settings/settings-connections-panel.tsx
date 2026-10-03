'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/console/dialog';
import { Panel } from '@/components/console/panel';
import { Button } from '@/components/console/button';
import { CURRENT_USER } from '@/lib/console';
import { cn } from '@/lib/utils';

import { CONNECT_GOOGLE_MS } from './settings-config';
import { useSchedule } from './settings-timers';

/**
 * 第三方账号：目前只有谷歌。未绑定时显示「绑定」，点后转 1 秒圈变成已绑定并显示绑定的邮箱；
 * 已绑定时显示「解绑」，确认后回到未绑定。
 */
export function SettingsConnectionsPanel() {
  const t = useTranslations('consoleSettings');
  const schedule = useSchedule();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [unbindOpen, setUnbindOpen] = useState(false);

  const connect = () => {
    setConnecting(true);
    schedule(() => {
      setConnecting(false);
      setConnected(true);
    }, CONNECT_GOOGLE_MS);
  };

  return (
    <>
      <Panel id="connections" title={t('connections.title')}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/brands/google.svg"
              alt=""
              aria-hidden
              width={20}
              height={20}
              loading="lazy"
              decoding="async"
              className="size-5 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Google</p>
              <p
                className={cn(
                  'truncate text-xs',
                  connected ? 'text-muted-foreground' : 'text-subtle-foreground',
                )}
              >
                {connected ? CURRENT_USER.email : t('connections.notBound')}
              </p>
            </div>
          </div>
          {connected ? (
            <Button variant="secondary" data-disconnect-google onClick={() => setUnbindOpen(true)}>
              {t('connections.unbind')}
            </Button>
          ) : (
            <Button variant="secondary" data-connect-google loading={connecting} onClick={connect}>
              {t('connections.bind')}
            </Button>
          )}
        </div>
      </Panel>

      <ConfirmDialog
        id="disconnect-google"
        open={unbindOpen}
        onOpenChange={setUnbindOpen}
        title={t('connections.unbindDialog.title')}
        description={t('connections.unbindDialog.description')}
        confirmLabel={t('connections.unbindDialog.confirm')}
        onConfirm={() => setConnected(false)}
      />
    </>
  );
}
