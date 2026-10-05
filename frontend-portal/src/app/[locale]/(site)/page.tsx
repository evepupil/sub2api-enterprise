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

/** 首屏的模型数和模型瀑布流来自后台，页面每 60 秒重新生成一次（和数据缓存同步） */
export const revalidate = 60;

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
