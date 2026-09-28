import { Blocks, CodeXml, Monitor, Plug, Server, Terminal } from 'lucide-react';
import type * as React from 'react';

import { MovingBorder } from '../../components/effects/moving-border';
import { MarketingLink } from '../../components/marketing/marketing-link';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';
import type { PublicSiteData } from '../public/types';
import { FaqSection } from './faq-section';
import { PricingSection } from './pricing-section';
import { ScenariosSection } from './scenarios-section';
import { StoriesSection } from './stories-section';
import { WorkspaceSection } from './workspace-section';

/**
 * 首页后半区块组装（规格第 5 节 5 / 6 / 8 / 9 / 10 / 11 / 12）。
 *
 * 对外只暴露 MarketingSections，按固定顺序渲染：
 * workspace → scenarios → modelSection 插槽 → pricing → stories →
 * integrations → faq → CTA。
 *
 * 数据边界：
 * - 营销文案与构造数据全部读 src/content/marketing.ts；
 * - 账户入口读 site.accountActions 与 site.settings.registrationEnabled，
 *   不硬编码注册或登录承诺，也不虚构外部联系方式。
 * - 除场景切换（scenarios-section 自带 'use client'）与 CTA 的 MovingBorder
 *   外，其余区块均为服务端组件；正文不依赖动画完成才可见。
 */

export interface MarketingSectionsProps {
  site: PublicSiteData;
  /** 首页前半插入的真实模型价格区块；缺省时该位置不渲染任何内容。 */
  modelSection?: React.ReactNode;
}

/** 工具生态：只表示可配置兼容接口的使用方向，不做供应商合作承诺。 */
const integrationIcons = [CodeXml, Terminal, Plug, Monitor, Blocks, Server] as const;

function IntegrationsSection() {
  return (
    <section
      id="integrations"
      data-slot="integrations-section"
      className="marketing-section marketing-shell ms-integrations"
      aria-labelledby="integrations-title"
    >
      <div className="ms-integrations-layout">
        <div className="ms-integrations-copy">
          <SectionHeading
            id="integrations-title"
            eyebrow="工具生态"
            title="融入你已经在用的工具。"
            description="把模型能力接进熟悉的工具，延续你已经习惯的工作方式。"
          />
          <p className="ms-integrations-link">
            <a className="marketing-inline-link" href="/help">
              查看接入说明
            </a>
          </p>
        </div>

        <ul className="ms-integration-grid">
          {marketingContent.integrations.map((tool, index) => {
            const Icon = integrationIcons[index] ?? Plug;
            return (
              <li key={tool} className="ms-integration-item marketing-surface">
                <span className="ms-integration-icon" aria-hidden="true">
                  <Icon className="ms-integration-icon-svg" />
                </span>
                <span className="ms-integration-name">{tool}</span>
                <span className="ms-integration-type">兼容接口</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
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
            你的下一个产品，从这里开始。
          </h2>
          <p className="ms-cta-description">
            一个账户接入主流模型，余额按量计费，个人与团队都能安心推进。
          </p>
          <div className="marketing-actions ms-cta-actions">
            <MarketingLink href={primary.href} arrow>
              {primary.label}
            </MarketingLink>
            <MarketingLink href="/catalog" variant="outline">
              查看模型与价格
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
      <WorkspaceSection />
      <ScenariosSection />
      {modelSection}
      <PricingSection site={site} />
      <StoriesSection />
      <IntegrationsSection />
      <FaqSection />
      <CtaSection site={site} />
    </>
  );
}
