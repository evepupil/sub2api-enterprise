import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { GroupCards } from '@/blocks/groups/group-cards';
import { GroupsFaq } from '@/blocks/groups/groups-faq';
import { GroupsHero } from '@/blocks/groups/groups-hero';
import { GroupsLogos } from '@/blocks/groups/groups-logos';
import { PrivilegeTable } from '@/blocks/groups/privilege-table';
import { initPage, type LocaleParams } from '@/i18n/page';
import { pageAlternates } from '@/lib/seo';

/** 通道页：三种通道（后端的分组）的权益对比，不展示倍率。区块与文案命名空间沿用 groups。 */
export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'groups' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: pageAlternates(locale, '/channels'),
  };
}

export default async function ChannelsPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <>
      <GroupsHero />
      <GroupCards />
      <PrivilegeTable />
      <GroupsFaq />
      <GroupsLogos />
    </>
  );
}
