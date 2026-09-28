import type * as React from 'react';

import { MovingBorder } from '../../components/effects/moving-border';
import { MarketingLink } from '../../components/marketing/marketing-link';
import { marketingContent } from '../../content/marketing';
import type { PublicSiteData } from '../public/types';
import { FaqSection } from './faq-section';
import { GovernanceSection } from './governance-section';
import { PricingSection } from './pricing-section';
import { ServiceSection } from './service-section';

/**
 * 首页后半区块组装。
 *
 * 对外只暴露 MarketingSections，按固定顺序渲染：
 * governance → modelSection 插槽 → pricing → service → faq → CTA。
 *
 * 数据边界：
 * - 营销文案全部读 src/content/marketing.ts；
 * - 账户入口读 site.accountActions 与 site.settings.registrationEnabled，
 *   不硬编码注册或登录承诺，也不虚构外部联系方式。
 * - 除 CTA 的 MovingBorder 外，其余区块均为服务端组件；正文不依赖动画完成才可见。
 */

export interface MarketingSectionsProps {
  site: PublicSiteData;
  /** 真实模型价格区块；缺省时该位置不渲染任何内容。 */
  modelSection?: React.ReactNode;
}

/** 从账号操作中选出主入口：优先 primary，其次第一个可用项，最后回落到模型目录。 */
function pickPrimaryAction(site: PublicSiteData): { href: string; label: string } {
  const actions = site.accountActions;
  const primary = actions.find((action) => action.primary === true) ?? actions[0];
  if (primary === undefined) {
    return { href: '/catalog', label: '浏览模型' };
  }
  return { href: primary.href, label: primary.label };
}

function CtaSection({ site }: { site: PublicSiteData }) {
  const primary = pickPrimaryAction(site);
  const cta = marketingContent.cta;

  return (
    <section
      id="cta"
      data-slot="marketing-cta"
      className="marketing-section marketing-shell ms-cta"
      aria-labelledby="cta-title"
    >
      <MovingBorder className="ms-cta-border">
        <div className="ms-cta-card">
          <h2 id="cta-title" className="ms-cta-title">
            {cta.title}
          </h2>
          <div className="marketing-actions ms-cta-actions">
            <MarketingLink href={primary.href} arrow>
              {primary.label}
            </MarketingLink>
            <MarketingLink href="/catalog" variant="outline">
              {cta.secondary}
            </MarketingLink>
          </div>
          <p className="ms-cta-foot">
            <span className="ms-cta-brand">{marketingContent.brand.name}</span>
            <span className="ms-cta-tagline">{marketingContent.brand.tagline}</span>
          </p>
        </div>
      </MovingBorder>
    </section>
  );
}

export function MarketingSections({ site, modelSection }: MarketingSectionsProps) {
  return (
    <>
      <GovernanceSection />
      {modelSection}
      <PricingSection site={site} />
      <ServiceSection />
      <FaqSection />
      <CtaSection site={site} />
    </>
  );
}
