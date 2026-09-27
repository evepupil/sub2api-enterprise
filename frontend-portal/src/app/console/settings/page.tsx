import type { Metadata } from 'next';

import { SettingsView } from '@/features/settings/settings-view';

export const metadata: Metadata = {
  title: '账号设置',
};

export default function ConsoleSettingsPage() {
  return <SettingsView />;
}
