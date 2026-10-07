'use client';

import { useTranslations } from 'next-intl';

import { ConsolePage } from '@/components/console/console-page';

import { SettingsPasswordPanel } from './settings-password-panel';
import { SettingsProfilePanel } from './settings-profile-panel';

/**
 * 账户设置：个人资料、登录密码两块面板竖排，页面收窄到 768（标题行跟着收窄、对齐），表单不会拉得过宽。
 * 改名称、改密码都提交给后台。两步验证不做（2026-10-07 用户定：只用账号密码登录）；
 * 第三方账号绑定等谷歌登录接好后再加。
 */
export function SettingsPage() {
  const t = useTranslations('consoleSettings');
  return (
    <ConsolePage id="settings" title={t('meta.title')} width="narrow">
      <SettingsProfilePanel />
      <SettingsPasswordPanel />
    </ConsolePage>
  );
}
