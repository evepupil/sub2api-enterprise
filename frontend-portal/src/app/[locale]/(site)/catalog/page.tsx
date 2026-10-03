import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ModelsExplorer } from '@/blocks/models/models-explorer';
import { ModelsHero } from '@/blocks/models/models-hero';
import { initPage, type LocaleParams } from '@/i18n/page';

/**
 * 模型页。地址用 /catalog 而不是 /models：官网和后端以后合并在同一个域名下，
 * 后端已经有一个 /models 接口（不带 /v1 的模型列表），用同一个地址会撞车。
 */
export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'models' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function ModelsPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <>
      <ModelsHero />
      <ModelsExplorer />
    </>
  );
}
