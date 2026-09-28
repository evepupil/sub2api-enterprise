import { Activity, Building2, LifeBuoy, Server, type LucideIcon } from 'lucide-react';

import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

/**
 * 首页区块：服务保障（#service）。
 * 技术支持、数据归属、状态公开与部署方式；只写已核实或已承诺的服务内容。
 */

type ServiceKind = (typeof marketingContent.service)[number]['kind'];

const serviceIcons: Record<ServiceKind, LucideIcon> = {
  support: LifeBuoy,
  ownership: Building2,
  status: Activity,
  deployment: Server,
};

export function ServiceSection() {
  const heading = marketingContent.sections.service;

  return (
    <section
      id="service"
      data-slot="service-section"
      className="marketing-section marketing-shell ms-service"
      aria-labelledby="service-title"
    >
      <SectionHeading id="service-title" eyebrow={heading.eyebrow} title={heading.title} />
      <ul className="ms-service-list">
        {marketingContent.service.map((item) => {
          const Icon = serviceIcons[item.kind];

          return (
            <li key={item.kind} className="ms-service-item marketing-surface">
              <span className="ms-service-icon" aria-hidden="true">
                <Icon className="ms-service-icon-svg" />
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
