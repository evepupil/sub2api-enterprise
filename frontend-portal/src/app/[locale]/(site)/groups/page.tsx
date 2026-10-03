import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { GroupCards } from '@/blocks/groups/group-cards';
import { GroupsFaq } from '@/blocks/groups/groups-faq';
import { GroupsHero } from '@/blocks/groups/groups-hero';
import { GroupsLogos } from '@/blocks/groups/groups-logos';
import { PrivilegeTable } from '@/blocks/groups/privilege-table';
import { RatioExplainer } from '@/blocks/groups/ratio-explainer';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'groups' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function GroupsPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <>
      <GroupsHero />
      <GroupCards />
      <RatioExplainer />
      <PrivilegeTable />
      <GroupsFaq />
      <GroupsLogos />
    </>
  );
}
