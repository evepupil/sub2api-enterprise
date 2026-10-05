import { ConsolePreview } from '@/blocks/home/console-preview';
import { FeatureGrid } from '@/blocks/home/feature-grid';
import { FeaturesBento } from '@/blocks/home/features-bento';
import { HomeCta } from '@/blocks/home/home-cta';
import { HomeHero } from '@/blocks/home/hero';
import { ModelMarquee } from '@/blocks/home/model-marquee';
import { ProviderLogos } from '@/blocks/home/provider-logos';
import { initPage, type LocaleParams } from '@/i18n/page';
import { siteModelCount } from '@/lib/catalog/live';
import { getSiteCatalog } from '@/lib/server/site-catalog';

/**
 * 模型数据来自后台：每次打开都用官网服务器缓存（60 秒）里的数据现做页面，不在构建时预先生成——
 * 构建时通常连不上后台，预先生成会让部署后的第一位访客看到空页面。
 */
export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: LocaleParams) {
  await initPage(params);
  const catalog = await getSiteCatalog();
  return (
    <>
      <HomeHero count={siteModelCount(catalog)} />
      <ConsolePreview />
      <ProviderLogos />
      <FeaturesBento />
      <FeatureGrid />
      <ModelMarquee models={catalog.personal} />
      <HomeCta />
    </>
  );
}
