import { PageHero } from '@/components/layout/page-hero';
import { useTranslations } from 'next-intl';

/** 通道页页首：居中大标题加副标题。三种通道直接在下面的通道卡里并排，不做通道切换。 */
export function GroupsHero() {
  const t = useTranslations('groups');

  return <PageHero id="groups-hero" title={t('hero.title')} subtitle={t('hero.subtitle')} />;
}

export default GroupsHero;
