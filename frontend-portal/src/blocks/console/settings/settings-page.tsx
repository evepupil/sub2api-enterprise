'use client';

import { useTranslations } from 'next-intl';

import { ConsolePage } from '@/components/console/console-page';

import { SettingsConnectionsPanel } from './settings-connections-panel';
import { SettingsPasswordPanel } from './settings-password-panel';
import { SettingsProfilePanel } from './settings-profile-panel';
import { SettingsTwoFactorPanel } from './settings-two-factor-panel';

/**
 * 账户设置：个人资料、登录密码、两步验证、第三方账号四块面板竖排，
 * 内容区收窄到 max-w-3xl，表单不会拉得过宽。所有修改只改本页状态，不发请求。
 */
export function SettingsPage() {
  const t = useTranslations('consoleSettings');
  return (
    <ConsolePage id="settings" title={t('meta.title')} className="max-w-3xl">
      <SettingsProfilePanel />
      <SettingsPasswordPanel />
      <SettingsTwoFactorPanel />
      <SettingsConnectionsPanel />
    </ConsolePage>
  );
}
