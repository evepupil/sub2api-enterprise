import type { Metadata } from 'next';

import { BillingView } from '@/features/billing/billing-view';

import { parsePositiveInteger } from '../search-params';

export const metadata: Metadata = {
  title: '余额与订单',
};

export interface ConsoleBillingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * 支付回跳只带订单编号，两种参数名都接受；只取正整数，
 * 不把非法值传给视图，也不在服务端发起任何请求。
 */
export default async function ConsoleBillingPage({ searchParams }: ConsoleBillingPageProps) {
  const params = await searchParams;
  const initialOrderId =
    parsePositiveInteger(params['order_id']) ?? parsePositiveInteger(params['payment_order_id']);

  return <BillingView initialOrderId={initialOrderId} />;
}
