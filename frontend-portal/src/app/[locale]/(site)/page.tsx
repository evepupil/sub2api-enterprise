import { ConsolePreview } from '@/blocks/home/console-preview';
import { FeatureGrid } from '@/blocks/home/feature-grid';
import { FeaturesBento } from '@/blocks/home/features-bento';
import { HomeCta } from '@/blocks/home/home-cta';
import { HomeHero } from '@/blocks/home/hero';
import { ModelMarquee } from '@/blocks/home/model-marquee';
import { ProviderLogos } from '@/blocks/home/provider-logos';
import { initPage, type LocaleParams } from '@/i18n/page';

export default async function HomePage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <>
      <HomeHero />
      <ConsolePreview />
      <ProviderLogos />
      <FeaturesBento />
      <FeatureGrid />
      <ModelMarquee />
      <HomeCta />
    </>
  );
}
