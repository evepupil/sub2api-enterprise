import { EditionSummary } from '@/components/catalog/edition-summary';
import { EditionSwitcher } from '@/components/catalog/edition-switcher';
import { PageHero } from '@/components/layout/page-hero';
import { useTranslations } from 'next-intl';

import { MODELS } from '@/lib/catalog';

/** 模型页页首：居中标题、版本切换和版本指标，版本存在网址 ?edition= 里，与下方模型浏览器联动。 */
export function ModelsHero() {
  const t = useTranslations('models');
  return (
    <PageHero
      id="models-hero"
      title={t('hero.title')}
      subtitle={t('hero.subtitle', { count: MODELS.length })}
    >
      <EditionSwitcher />
      <EditionSummary />
    </PageHero>
  );
}

export default ModelsHero;
