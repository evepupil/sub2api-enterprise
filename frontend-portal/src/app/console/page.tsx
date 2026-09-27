import type { Metadata } from 'next';

import { OverviewView } from '@/features/usage/overview-view';

export const metadata: Metadata = {
  title: '概览',
};

export default function ConsoleOverviewPage() {
  return <OverviewView />;
}
