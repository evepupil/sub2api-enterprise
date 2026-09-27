import type { Metadata } from 'next';

import { KeysView } from '@/features/keys/keys-view';

export const metadata: Metadata = {
  title: '密钥管理',
};

export default function ConsoleKeysPage() {
  return <KeysView />;
}
