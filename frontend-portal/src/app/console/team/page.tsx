import type { Metadata } from 'next';
import { TeamView } from '@/features/organization/team-view';

export const metadata: Metadata = { title: '组织成员' };
export default function TeamPage() {
  return <TeamView />;
}
