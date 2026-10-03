'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/console/dialog';
import { Panel } from '@/components/console/panel';
import { Switch } from '@/components/console/switch';
import { Badge } from '@/components/ui/badge';

import { TWO_FACTOR_CODE_LENGTH } from './settings-config';
import { SettingsTwoFactorSetupDialog } from './settings-two-factor-setup-dialog';

/**
 * 两步验证：一行说明加状态徽标，右边一个开关。
 * 开关不直接切换：从关到开先弹出绑定验证器的弹窗，输对动态码才算开启；
 * 从开到关先弹确认框，确认后才关闭。
 */
export function SettingsTwoFactorPanel() {
  const t = useTranslations('consoleSettings');
  const [enabled, setEnabled] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  return (
    <>
      <Panel id="two-factor" title={t('twoFactor.title')}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground">
              {t('twoFactor.description', { digits: TWO_FACTOR_CODE_LENGTH })}
            </p>
            <Badge tone={enabled ? 'success' : 'neutral'}>
              {enabled ? t('twoFactor.on') : t('twoFactor.off')}
            </Badge>
          </div>
          <Switch
            name="two-factor"
            checked={enabled}
            ariaLabel={t('twoFactor.title')}
            onCheckedChange={(next) => (next ? setSetupOpen(true) : setDisableOpen(true))}
          />
        </div>
      </Panel>

      {setupOpen ? (
        <SettingsTwoFactorSetupDialog
          onClose={() => setSetupOpen(false)}
          onEnabled={() => {
            setEnabled(true);
            setSetupOpen(false);
          }}
        />
      ) : null}

      <ConfirmDialog
        id="two-factor-off"
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title={t('twoFactor.disable.title')}
        description={t('twoFactor.disable.description')}
        confirmLabel={t('twoFactor.disable.confirm')}
        onConfirm={() => setEnabled(false)}
      />
    </>
  );
}
