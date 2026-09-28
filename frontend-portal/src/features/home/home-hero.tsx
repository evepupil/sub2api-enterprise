import { ArrowUpRight, Check } from 'lucide-react';

import { Spotlight } from '../../components/effects/spotlight';
import { MarketingLink } from '../../components/marketing/marketing-link';
import { marketingContent } from '../../content/marketing';
import type { PublicSiteData } from '../public/types';

interface HomeHeroProps {
  site: PublicSiteData;
}

function isRegistrationAction(href: string): boolean {
  return /^\/register(?:[/?#]|$)/.test(href);
}

function getPrimaryAction(site: PublicSiteData): { href: string; label: string } {
  const actions = site.settings.registrationEnabled
    ? site.accountActions
    : site.accountActions.filter((action) => !isRegistrationAction(action.href));
  const action = actions.find((item) => item.primary === true) ?? actions[0];

  if (action === undefined) {
    return { href: '/catalog', label: '开始使用' };
  }

  return {
    href: action.href,
    label: action.primary === true ? '开始使用' : action.label,
  };
}

export function HomeHero({ site }: HomeHeroProps) {
  const { hero } = marketingContent;
  const primaryAction = getPrimaryAction(site);

  return (
    <section className="home-hero" data-slot="marketing-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-grid" aria-hidden="true" />
      <Spotlight />
      <div className="marketing-shell home-hero-shell">
        <a className="home-hero-eyebrow" href="/catalog">
          <span>{hero.eyebrow}</span>
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>

        <h1 id="home-hero-title" className="marketing-heading home-hero-title">
          <span>{hero.lines[0]}</span>
          <span>{hero.lines[1]}</span>
        </h1>
        <p className="home-hero-description">{hero.description}</p>

        <div className="marketing-actions home-hero-actions">
          <MarketingLink href={primaryAction.href} arrow>
            {primaryAction.label}
          </MarketingLink>
          <MarketingLink href="/catalog" variant="outline">
            查看模型
          </MarketingLink>
        </div>

        <ul className="home-hero-benefits" aria-label="平台特点">
          {hero.benefits.map((benefit) => (
            <li key={benefit}>
              <Check className="size-4" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
