import { Building2, KeyRound, PowerOff, Wallet, type LucideIcon } from 'lucide-react';

import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

/**
 * 首页区块：组织管控（#governance）。
 *
 * 左侧标题与四项组织管控能力；右侧团队配额面板迁自原工作空间区块，
 * 只读取 marketingContent.dashboard 的 members 与 period，
 * 不代表真实账户数据。纯服务端组件，不含客户端状态。
 */

type GovernanceKind = (typeof marketingContent.governance)[number]['kind'];

const governanceIcons: Record<GovernanceKind, LucideIcon> = {
  isolation: Building2,
  budget: Wallet,
  scope: KeyRound,
  suspend: PowerOff,
};

const { dashboard } = marketingContent;

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

/** 团队配额示意面板：迁自原工作空间区块，只保留成员配额列表，不含消费趋势。 */
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

export function GovernanceSection() {
  const heading = marketingContent.sections.governance;

  return (
    <section
      id="governance"
      data-slot="governance-section"
      className="marketing-section marketing-shell ms-governance"
      aria-labelledby="governance-title"
    >
      <div className="ms-split">
        <div className="ms-copy">
          <SectionHeading id="governance-title" eyebrow={heading.eyebrow} title={heading.title} />
          <ul className="ms-governance-list">
            {marketingContent.governance.map((item) => {
              const Icon = governanceIcons[item.kind];

              return (
                <li key={item.kind} className="ms-governance-item marketing-surface">
                  <span className="ms-governance-icon" aria-hidden="true">
                    <Icon className="ms-governance-icon-svg" />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="ms-visual">
          <QuotaPanel />
        </div>
      </div>
    </section>
  );
}
