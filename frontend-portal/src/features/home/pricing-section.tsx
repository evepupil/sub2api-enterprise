import { Check } from 'lucide-react';

import { MarketingLink } from '../../components/marketing/marketing-link';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';
import type { PublicSiteData } from '../public/types';

/**
 * 首页区块：计费方式（#pricing）。
 *
 * 三张卡依次为个人版、企业版、模型价格，文案与入口全部来自 marketingContent.plans；
 * 企业版为推荐卡，沿用现有推荐卡强调样式。注册关闭时个人版卡的入口回退登录，
 * 不承诺可直接创建账户。
 */

const { plans } = marketingContent;

/** 注册关闭时不能承诺创建账户，入口与按钮文字都退回登录。 */
function personalAction(
  registrationEnabled: boolean,
  plan: { href: string; action: string },
): { href: string; label: string } {
  return registrationEnabled
    ? { href: plan.href, label: plan.action }
    : { href: '/login', label: '登录' };
}

export function PricingSection({ site }: { site: PublicSiteData }) {
  const heading = marketingContent.sections.pricing;

  return (
    <section
      id="pricing"
      data-slot="pricing-section"
      className="marketing-section marketing-shell ms-pricing"
      aria-labelledby="pricing-title"
    >
      <SectionHeading id="pricing-title" eyebrow={heading.eyebrow} title={heading.title} />

      <ul className="ms-price-grid">
        {plans.map((plan, index) => {
          const action =
            index === 0
              ? personalAction(site.settings.registrationEnabled, plan)
              : { href: plan.href, label: plan.action };
          const recommended = index === 1;

          return (
            <li
              key={plan.title}
              className="ms-price-card marketing-surface"
              data-recommended={recommended ? 'true' : undefined}
            >
              <h3 className="ms-price-title">{plan.title}</h3>
              <p className="ms-price-value">{plan.value}</p>
              <p className="ms-price-description">{plan.description}</p>
              <ul className="ms-price-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check className="ms-feature-icon" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="marketing-actions marketing-actions-start ms-price-action">
                <MarketingLink
                  href={action.href}
                  variant={recommended ? 'default' : 'outline'}
                  arrow
                >
                  {action.label}
                </MarketingLink>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
