import { EditionSummary } from '@/components/catalog/edition-summary';
import { EditionSwitcher } from '@/components/catalog/edition-switcher';
import { PageHero } from '@/components/layout/page-hero';
import { useTranslations } from 'next-intl';

/** 分组页页首：居中大标题加副标题，下面是版本切换和当前版本的关键指标。 */
export function GroupsHero() {
  const t = useTranslations('groups');

  return (
    <PageHero id="groups-hero" title={t('hero.title')} subtitle={t('hero.subtitle')}>
      <EditionSwitcher />
      <EditionSummary />
    </PageHero>
  );
}

export default GroupsHero;
