import type { Metadata } from 'next';

import { UsageView } from '@/features/usage/usage-view';

import { parsePositiveInteger } from '../search-params';

export const metadata: Metadata = {
  title: '用量明细',
};

export interface ConsoleUsagePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** 从密钥页进入时带 api_key_id；只接受正整数，其余按未带入处理。 */
export default async function ConsoleUsagePage({ searchParams }: ConsoleUsagePageProps) {
  const params = await searchParams;
  const initialKeyId = parsePositiveInteger(params['api_key_id']);

  return <UsageView key={initialKeyId ?? 'all'} initialKeyId={initialKeyId} />;
}
