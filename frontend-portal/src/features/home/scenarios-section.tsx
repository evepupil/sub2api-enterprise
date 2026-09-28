'use client';

import { Check, CornerDownLeft, Cpu, Send } from 'lucide-react';
import * as React from 'react';

import {
  SlidingIndicator,
  useSlidingIndicatorId,
} from '../../components/effects/sliding-indicator';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

/**
 * 首页区块 6：使用场景（#scenarios）。
 *
 * 规格：design/proactiv-redesign.md 第 5 节第 6 条。
 * 三个按钮是真实可切换的 tab：使用 tablist / tab / tabpanel 语义，
 * 方向键可切换、aria-selected 与 tabIndex 同步，键盘焦点始终可见。
 * 右侧小画面由原生 HTML 组成，内容取自 marketingContent.scenarios，
 * 只演示布局，不发请求、不代表真实调用结果。
 */

const scenarios = marketingContent.scenarios;

export function ScenariosSection() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const indicatorId = useSlidingIndicatorId();
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const active = scenarios[activeIndex] ?? scenarios[0];

  function select(index: number, focus = false) {
    const next = (index + scenarios.length) % scenarios.length;
    setActiveIndex(next);
    if (focus) {
      tabRefs.current[next]?.focus();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      select(activeIndex + 1, true);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(activeIndex - 1, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(scenarios.length - 1, true);
    }
  }

  return (
    <section
      id="scenarios"
      data-slot="scenario-tabs"
      className="marketing-section marketing-shell ms-scenarios"
      aria-labelledby="scenarios-title"
    >
      <SectionHeading
        id="scenarios-title"
        eyebrow="使用场景"
        title="从想法到交付，都能找到合适的用法。"
        description="不同的工作有不同的取舍。选择你的场景，看看模型、密钥与用量如何一起工作。"
      />

      <div className="ms-tabs" role="tablist" aria-label="使用场景">
        {scenarios.map((scenario, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={scenario.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`scenario-tab-${scenario.id}`}
              aria-selected={selected}
              aria-controls={`scenario-panel-${scenario.id}`}
              tabIndex={selected ? 0 : -1}
              className="ms-tab"
              onClick={() => select(index)}
              onKeyDown={onKeyDown}
            >
              {selected ? <SlidingIndicator layoutId={indicatorId} /> : null}
              <span className="sliding-indicator-label">{scenario.label}</span>
            </button>
          );
        })}
      </div>

      {active !== undefined ? (
        <div
          key={active.id}
          role="tabpanel"
          id={`scenario-panel-${active.id}`}
          aria-labelledby={`scenario-tab-${active.id}`}
          tabIndex={0}
          className="ms-scenario-panel"
        >
          <div className="ms-scenario-copy">
            <h3>{active.title}</h3>
            <p className="ms-scenario-description">{active.description}</p>
            <ul className="ms-task-list">
              {active.tasks.map((task) => (
                <li key={task}>
                  <Check className="ms-task-icon" aria-hidden="true" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
            <ul className="ms-tag-list">
              {active.tags.map((tag) => (
                <li key={tag} className="ms-tag">
                  {tag}
                </li>
              ))}
            </ul>
          </div>

          <div className="ms-scenario-screen marketing-surface" aria-hidden="true">
            <div className="ms-screen-bar">
              <span className="ms-screen-dot" />
              <span className="ms-screen-dot" />
              <span className="ms-screen-dot" />
              <span className="ms-screen-title">{active.screenTitle}</span>
            </div>
            <div className="ms-screen-body">
              <div className="ms-screen-chat">
                <div className="ms-bubble ms-bubble-user">
                  <span>{active.prompt}</span>
                </div>
                <div className="ms-bubble ms-bubble-assistant">
                  <span className="ms-bubble-model">
                    <Cpu className="ms-bubble-icon" aria-hidden="true" />
                    {active.model}
                  </span>
                  <span>{active.result}</span>
                </div>
              </div>
              <ol className="ms-screen-steps">
                {active.items.map((item, index) => (
                  <li key={item} className="ms-screen-step">
                    <span className="ms-screen-step-index">{index + 1}</span>
                    <span className="ms-screen-step-text">{item}</span>
                  </li>
                ))}
              </ol>
              <div className="ms-screen-compose">
                <span className="ms-screen-placeholder">继续追问或调整任务…</span>
                <span className="ms-screen-send">
                  <Send className="ms-screen-send-icon" aria-hidden="true" />
                </span>
              </div>
              <p className="ms-screen-foot">
                <CornerDownLeft className="ms-screen-foot-icon" aria-hidden="true" />
                按项目管理密钥与用量
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
