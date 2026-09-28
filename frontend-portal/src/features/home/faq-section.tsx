import { ChevronDown, LifeBuoy } from 'lucide-react';

import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

/**
 * 首页区块：常见问题（#faq）。
 * 使用原生 details / summary，展开收起与键盘操作由浏览器保证，
 * 不手写无键盘支持的 div 折叠；首项默认展开。
 * 问答来自 marketingContent.faqs，只陈述首版已有边界。
 */

const faqs = marketingContent.faqs;

export function FaqSection() {
  return (
    <section
      id="faq"
      data-slot="marketing-faq"
      className="marketing-section marketing-shell ms-faq"
      aria-labelledby="faq-title"
    >
      <div className="ms-faq-layout">
        <div className="ms-faq-intro">
          <SectionHeading
            id="faq-title"
            eyebrow={marketingContent.sections.faq.eyebrow}
            title={marketingContent.sections.faq.title}
          />
          <p className="ms-faq-help">
            <LifeBuoy className="ms-faq-help-icon" aria-hidden="true" />
            <a className="marketing-inline-link" href="/help">
              在帮助中心查看接入文档
            </a>
          </p>
        </div>

        <ul className="ms-faq-list">
          {faqs.map((faq, index) => (
            <li key={faq.question}>
              <details className="ms-faq-item" open={index === 0}>
                <summary className="ms-faq-summary">
                  <span className="ms-faq-question">{faq.question}</span>
                  <ChevronDown className="ms-faq-chevron" aria-hidden="true" />
                </summary>
                <p className="ms-faq-answer">{faq.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
