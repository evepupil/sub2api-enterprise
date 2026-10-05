import { EditionSummary } from '@/components/catalog/edition-summary';
import { EditionSwitcher } from '@/components/catalog/edition-switcher';
import { PageHero } from '@/components/layout/page-hero';
import { useTranslations } from 'next-intl';

/**
 * 模型页页首：居中标题、通道切换和通道指标，通道存在网址 ?edition= 里，与下方模型浏览器联动。
 * 模型数来自后台；读不到时副标题不写数字。
 */
export function ModelsHero({ count }: { count: number | null }) {
  const t = useTranslations('models');
  return (
    <PageHero
      id="models-hero"
      title={t('hero.title')}
      subtitle={count === null ? t('hero.subtitleNoCount') : t('hero.subtitle', { count })}
    >
      <EditionSwitcher />
      <EditionSummary />
    </PageHero>
  );
}

export default ModelsHero;
