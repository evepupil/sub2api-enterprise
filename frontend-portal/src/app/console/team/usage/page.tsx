import type { Metadata } from 'next';
import { OrganizationUsageView } from '@/features/organization-usage/organization-usage-view';
import { parsePositiveInteger } from '../../search-params';

export const metadata: Metadata = { title: '组织用量' };
export default async function OrganizationUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const memberId = parsePositiveInteger(params.member_user_id);
  return <OrganizationUsageView key={memberId ?? 'all'} initialMemberId={memberId} />;
}
