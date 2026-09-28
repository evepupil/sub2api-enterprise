import { Check, Wallet } from 'lucide-react';

import { MarketingLink } from '../../components/marketing/marketing-link';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';
import type { PublicSiteData } from '../public/types';

/**
 * 首页区块 8：余额计费（#pricing）。
 *
 * 规格：design/proactiv-redesign.md 第 5 节第 8 条。
 * 只描述余额按量计费，没有套餐表、订阅切换或购买按钮；
 * 入口按注册开关调整：注册关闭时“个人开发”卡走登录，团队卡固定去工作台。
 * 卡片能力与说明全部来自 marketingContent.pricing。
 */

const { pricing, faqs } = marketingContent;

/** 注册关闭时不能承诺创建账户，退回登录入口。 */
function personalHref(registrationEnabled: boolean, configured: string): string {
  return registrationEnabled ? configured : '/login';
}

export function PricingSection({ site }: { site: PublicSiteData }) {
  const billingFaq = faqs[1];

  return (
    <section
      id="pricing"
      data-slot="pricing-section"
      className="marketing-section marketing-shell ms-pricing"
      aria-labelledby="pricing-title"
    >
      <SectionHeading
        id="pricing-title"
        eyebrow="余额计费"
        title="一个余额，按实际使用付费。"
        description="不为用不到的能力买单。余额、配额与四项价格都写在账单里，随时可以核对。"
      />

      <ul className="ms-price-grid">
        {pricing.map((plan, index) => {
          const href =
            index === 0 ? personalHref(site.settings.registrationEnabled, plan.href) : plan.href;
          const recommended = index === 1;

          return (
            <li
              key={plan.title}
              className="ms-price-card marketing-surface"
              data-recommended={recommended ? 'true' : undefined}
            >
              <div className="ms-price-head">
                <span className="ms-price-icon" aria-hidden="true">
                  <Wallet className="ms-price-icon-svg" />
                </span>
                <span className="ms-chip">{plan.label}</span>
              </div>
              <h3 className="ms-price-title">{plan.title}</h3>
              <p className="ms-price-subtitle">{plan.subtitle}</p>
              <ul className="ms-price-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check className="ms-feature-icon" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="marketing-actions marketing-actions-start ms-price-action">
                <MarketingLink href={href} variant={recommended ? 'default' : 'outline'} arrow>
                  {plan.action}
                </MarketingLink>
              </div>
            </li>
          );
        })}
      </ul>

      {billingFaq !== undefined ? (
        <p className="ms-price-note">
          {billingFaq.answer}
          <a className="marketing-inline-link" href="#faq">
            常见问题
          </a>
        </p>
      ) : null}
    </section>
  );
}
