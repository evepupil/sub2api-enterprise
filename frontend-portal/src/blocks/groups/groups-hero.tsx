import { PageHero } from '@/components/layout/page-hero';
import { useTranslations } from 'next-intl';

/** 分组页页首：居中大标题加副标题。三个版本直接在下面的分组卡里并排，不做版本切换。 */
export function GroupsHero() {
  const t = useTranslations('groups');

  return <PageHero id="groups-hero" title={t('hero.title')} subtitle={t('hero.subtitle')} />;
}

export default GroupsHero;
