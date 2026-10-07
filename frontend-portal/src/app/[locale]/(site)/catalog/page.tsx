import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ModelsExplorer } from '@/blocks/models/models-explorer';
import { ModelsHero } from '@/blocks/models/models-hero';
import { initPage, type LocaleParams } from '@/i18n/page';
import { pageAlternates } from '@/lib/seo';
import { siteModelCount } from '@/lib/catalog/live';
import { getSiteCatalog } from '@/lib/server/site-catalog';

/**
 * 模型数据来自后台：每次打开都用官网服务器缓存（60 秒）里的数据现做页面，不在构建时预先生成——
 * 构建时通常连不上后台，预先生成会让部署后的第一位访客看到空页面。
 */
export const dynamic = 'force-dynamic';

/**
 * 模型页。地址用 /catalog 而不是 /models：官网和后端以后合并在同一个域名下，
 * 后端已经有一个 /models 接口（不带 /v1 的模型列表），用同一个地址会撞车。
 */
export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'models' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: pageAlternates(locale, '/catalog'),
  };
}

export default async function ModelsPage({ params }: LocaleParams) {
  await initPage(params);
  const catalog = await getSiteCatalog();
  return (
    <>
      <ModelsHero count={siteModelCount(catalog)} />
      <ModelsExplorer catalog={catalog} />
    </>
  );
}
