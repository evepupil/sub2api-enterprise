import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.order_id;
  const orderId = typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
  // Payment credentials and untrusted success flags never enter the customer URL.
  redirect(
    Number.isSafeInteger(orderId) ? `/console/billing?order_id=${orderId}` : '/console/billing',
  );
}
