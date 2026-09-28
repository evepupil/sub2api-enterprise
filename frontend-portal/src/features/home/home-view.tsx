import { MarketingSections } from './marketing-sections';
import { DashboardShowcase } from './dashboard-showcase';
import { HomeHero } from './home-hero';
import { ModelPreview } from './model-preview';
import { PlatformSection, ProviderStrip } from './platform-section';
import type { CatalogData, PublicResult, PublicSiteData } from '../public/types';

export interface HomeViewProps {
  catalog: PublicResult<CatalogData>;
  site: PublicSiteData;
}

/** 首页只负责按规格排列各区块；数据和交互边界留在对应的区块组件内。 */
export function HomeView({ catalog, site }: HomeViewProps) {
  return (
    <div className="marketing-page">
      <HomeHero site={site} />
      <DashboardShowcase />
      <ProviderStrip />
      <PlatformSection />
      <MarketingSections site={site} modelSection={<ModelPreview catalog={catalog} />} />
    </div>
  );
}
