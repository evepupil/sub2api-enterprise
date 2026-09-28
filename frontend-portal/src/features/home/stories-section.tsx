import { Quote } from 'lucide-react';

import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

/**
 * 首页区块 9：客户故事（#stories）。
 *
 * 规格：design/proactiv-redesign.md 第 5 节第 9 条、第 7 节。
 * 六张卡片全部为本次授权的虚构案例，集中登记在 src/content/marketing.ts，
 * 不对应现实公司、人物或合作背书；部署前可整体替换。
 * 纯服务端组件，无交互依赖。
 */

const stories = marketingContent.stories;

export function StoriesSection() {
  return (
    <section
      id="stories"
      data-slot="stories-grid"
      className="marketing-section marketing-shell ms-stories"
      aria-labelledby="stories-title"
    >
      <SectionHeading
        id="stories-title"
        eyebrow="客户故事"
        title="让好想法，更快成为好产品。"
        description="从独立开发到团队协作，看看不同的产品如何把模型能力用在日常工作里。"
      />

      <ul className="ms-story-grid">
        {stories.map((story) => (
          <li key={story.company} className="ms-story-card marketing-surface">
            <div className="ms-story-head">
              <span className="ms-story-mark" aria-hidden="true">
                {story.mark}
              </span>
              <div className="ms-story-identity">
                <span className="ms-story-company">{story.company}</span>
                <span className="ms-story-category">{story.category}</span>
              </div>
              <Quote className="ms-story-quote-icon" aria-hidden="true" />
            </div>

            <blockquote className="ms-story-quote">{story.quote}</blockquote>

            <div className="ms-story-foot">
              <div className="ms-story-person">
                <span className="ms-story-name">{story.name}</span>
                <span className="ms-story-role">{story.role}</span>
              </div>
              <div className="ms-story-result">
                <span className="ms-story-result-value">{story.result}</span>
                <span className="ms-story-result-label">{story.resultLabel}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
