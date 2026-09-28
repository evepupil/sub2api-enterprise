import { Check, Sparkles } from 'lucide-react';

import { MarketingLink } from '../../components/marketing/marketing-link';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

/**
 * 首页区块 5：工作空间（#workspace）。
 *
 * 规格：design/proactiv-redesign.md 第 5 节第 5 条。
 * 文案全部来自 src/content/marketing.ts 的 workspace / dashboard，
 * 面板中的成员、金额、进度与趋势均由该构造数据推导，不读取真实账户。
 * 纯服务端组件：静态趋势视图不包含可点击控件，也不需要客户端状态。
 */

const { workspace, dashboard } = marketingContent;

/** 从 "$32.68" 这类展示值取回数值，仅用于把构造数据汇总成合计。 */
function parseAmount(value: string): number {
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

const totalSpend = dashboard.members.reduce((sum, member) => sum + parseAmount(member.spend), 0);
const totalQuota = dashboard.members.reduce((sum, member) => sum + parseAmount(member.quota), 0);

const balance = dashboard.stats[0];

/** 三张静态趋势视图：数值取自 dashboard.trend，只改变取样区间与呈现方式。 */
const trendViews = [
  { key: 'day', label: '日', caption: '近 7 天', values: dashboard.trend.slice(-7) },
  {
    key: 'week',
    label: '周',
    caption: '近 7 周',
    values: dashboard.trend.filter((_, index) => index % 2 === 0),
  },
  {
    key: 'month',
    label: '月',
    caption: '近 5 月',
    values: dashboard.trend.filter((_, index) => index % 3 === 1),
  },
];

function TrendView({
  label,
  caption,
  values,
}: {
  label: string;
  caption: string;
  values: readonly number[];
}) {
  const max = values.reduce((peak, value) => (value > peak ? value : peak), 1);

  return (
    <div className="ms-trend">
      <div className="ms-trend-head">
        <span className="ms-trend-label">{label}</span>
        <span className="ms-trend-caption">{caption}</span>
      </div>
      <div className="ms-trend-bars" role="img" aria-label={`${caption}消费趋势示意`}>
        {values.map((value, index) => (
          <span
            key={`${label}-${index}`}
            className="ms-trend-bar"
            style={{ height: `${Math.max(8, Math.round((value / max) * 100))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function QuotaPanel() {
  return (
    <div className="ms-panel marketing-surface">
      <div className="ms-panel-head">
        <div>
          <p className="ms-panel-title">团队配额</p>
          <p className="ms-panel-sub">
            {dashboard.members.length} 位成员 · {dashboard.period}
          </p>
        </div>
        <span className="ms-chip">{balance.label}</span>
      </div>

      <div className="ms-balance">
        <span className="ms-balance-label">{balance.label}</span>
        <span className="ms-balance-value">{balance.value}</span>
      </div>

      <ul className="ms-member-list">
        {dashboard.members.map((member) => (
          <li key={member.name} className="ms-member">
            <span className="ms-avatar" aria-hidden="true">
              {member.initials}
            </span>
            <div className="ms-member-body">
              <div className="ms-member-head">
                <span className="ms-member-name">{member.name}</span>
                <span className="ms-member-amount">
                  {member.spend} / {member.quota}
                </span>
              </div>
              <div
                className="ms-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={member.percent}
                aria-label={`${member.name} 配额使用 ${member.percent}%`}
              >
                <span className="ms-track-fill" style={{ width: `${member.percent}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="ms-total">
        <span>合计</span>
        <span className="ms-total-value">
          {formatUsd(totalSpend)} / {formatUsd(totalQuota)}
        </span>
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  return (
    <div className="ms-panel marketing-surface">
      <div className="ms-panel-head">
        <div>
          <p className="ms-panel-title">消费趋势</p>
          <p className="ms-panel-sub">按日 / 周 / 月查看调用花费</p>
        </div>
        <span className="ms-chip">{dashboard.period}</span>
      </div>

      <div className="ms-trend-grid">
        {trendViews.map((view) => (
          <TrendView
            key={view.key}
            label={view.label}
            caption={view.caption}
            values={view.values}
          />
        ))}
      </div>

      <ul className="ms-model-list">
        {dashboard.models.map((model) => (
          <li key={model.name} className="ms-model">
            <div className="ms-model-head">
              <span className="ms-model-name">{model.name}</span>
              <span className="ms-model-cost">{model.cost}</span>
            </div>
            <div className="ms-model-track" aria-hidden="true">
              <span className="ms-model-fill" style={{ width: `${model.percent}%` }} />
            </div>
            <p className="ms-model-meta">
              {model.tokens} Token · 占比 {model.percent}%
            </p>
          </li>
        ))}
      </ul>

      <ul className="ms-stat-row">
        {dashboard.stats.slice(1).map((stat) => (
          <li key={stat.label} className="ms-stat">
            <span className="ms-stat-label">{stat.label}</span>
            <span className="ms-stat-value">{stat.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkspaceSection() {
  return (
    <section
      id="workspace"
      data-slot="workspace-section"
      className="marketing-section marketing-shell ms-workspace"
      aria-labelledby="workspace-title"
    >
      <div className="ms-split">
        <div className="ms-copy">
          <SectionHeading
            id="workspace-title"
            eyebrow="工作空间"
            title={workspace.title}
            description={workspace.description}
          />
          <ul className="ms-points">
            {workspace.points.map((point) => (
              <li key={point}>
                <Check className="ms-point-icon" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="marketing-actions marketing-actions-start ms-actions">
            <MarketingLink href="/console" arrow>
              进入工作台
            </MarketingLink>
          </div>
        </div>
        <div className="ms-visual">
          <QuotaPanel />
        </div>
      </div>

      <div className="ms-split ms-split-reverse ms-split-spaced">
        <div className="ms-copy">
          <SectionHeading
            eyebrow="用量与费用"
            title={workspace.analyticsTitle}
            description={workspace.analyticsDescription}
          />
          <p className="ms-note">
            <Sparkles className="ms-note-icon" aria-hidden="true" />
            <span>模型分布、Token 构成与消费趋势放在同一张面板里，帮助决定下一步选择。</span>
          </p>
        </div>
        <div className="ms-visual">
          <AnalyticsPanel />
        </div>
      </div>
    </section>
  );
}
