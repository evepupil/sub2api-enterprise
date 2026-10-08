import { useTranslations } from 'next-intl';

import { TopUpRate } from '@/components/catalog/top-up-rate';
import { PageHero } from '@/components/layout/page-hero';

/**
 * 模型页页首：居中标题和副标题，下面一行小字写充值比例。
 * 模型数来自后台（同一个模型在几个分组里只算一个）；读不到时副标题不写数字。
 */
export function ModelsHero({ count }: { count: number | null }) {
  const t = useTranslations('models');
  return (
    <PageHero
      id="models-hero"
      title={t('hero.title')}
      subtitle={count === null ? t('hero.subtitleNoCount') : t('hero.subtitle', { count })}
      note={<TopUpRate />}
    />
  );
}

export default ModelsHero;
