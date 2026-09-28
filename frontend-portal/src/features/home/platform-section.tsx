import { Activity, ArrowUpRight, Gauge, KeyRound } from 'lucide-react';

import { GlowingEffect } from '../../components/effects/glowing-effect';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

const statusCells = Array.from({ length: 28 }, (_, index) => index);

function ProviderMark({ provider }: { provider: (typeof marketingContent.providers)[number] }) {
  return provider.logo !== null ? (
    // eslint-disable-next-line @next/next/no-img-element -- Provider marks are local, bundled assets.
    <img className="provider-mark-image" src={provider.logo} alt="" aria-hidden="true" />
  ) : (
    <span className="provider-mark-letter" aria-hidden="true">
      {provider.short}
    </span>
  );
}

export function ProviderStrip() {
  return (
    <section className="provider-strip marketing-section" aria-labelledby="provider-strip-title">
      <div className="marketing-shell">
        <div className="provider-strip-heading">
          <p className="marketing-eyebrow">模型接入</p>
          <h2 id="provider-strip-title">与你熟悉的模型一起工作。</h2>
          <span>一个入口，按需要选择合适的模型。</span>
        </div>
        <ul className="provider-strip-list" aria-label="可接入的模型厂家">
          {marketingContent.providers.map((provider) => (
            <li key={provider.name} className="provider-strip-item">
              <ProviderMark provider={provider} />
              <span>{provider.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RoutingVisual() {
  return (
    <div className="platform-routing-visual" aria-label="厂家经过统一入口连接到 API">
      <div className="platform-routing-providers" aria-hidden="true">
        {marketingContent.providers.slice(0, 4).map((provider) => (
          <span key={provider.name} className="platform-routing-node">
            <ProviderMark provider={provider} />
          </span>
        ))}
      </div>
      <div className="platform-routing-line" aria-hidden="true" />
      <span className="platform-routing-core">API</span>
      <span className="platform-routing-caption">一个接入点</span>
    </div>
  );
}

function AnalyticsVisual() {
  const spend =
    marketingContent.dashboard.stats.find((stat) => stat.icon === 'chart')?.value ?? '—';

  return (
    <div className="platform-analytics-visual" aria-label={`本周消费 ${spend}`}>
      <div className="platform-analytics-value">
        <strong>{spend}</strong>
        <span>本周消费</span>
      </div>
      <div className="platform-mini-bars" aria-hidden="true">
        {[34, 48, 42, 68, 52, 78, 61, 86, 72].map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="platform-analytics-meta">
        <span>请求</span>
        <strong>{marketingContent.dashboard.stats[1]?.value ?? '—'}</strong>
      </div>
    </div>
  );
}

function KeysVisual() {
  const keys = [
    { label: '研发应用', value: 'sk-••••••••', status: '活跃' },
    { label: '内容助手', value: 'sk-••••••••', status: '活跃' },
    { label: '实验项目', value: 'sk-••••••••', status: '待用' },
  ] as const;

  return (
    <div className="platform-keys-visual" aria-label="三个按应用分配的脱敏密钥">
      {keys.map((key) => (
        <div className="platform-key-row" key={key.label}>
          <span className="platform-key-icon" aria-hidden="true">
            <KeyRound className="size-3.5" />
          </span>
          <span className="platform-key-copy">
            <strong>{key.label}</strong>
            <small>{key.value}</small>
          </span>
          <span className="platform-key-status">{key.status}</span>
        </div>
      ))}
    </div>
  );
}

function TeamVisual() {
  return (
    <div className="platform-team-visual" aria-label="三个团队成员及其配额使用情况">
      {marketingContent.dashboard.members.map((member) => (
        <div className="platform-team-row" key={member.name}>
          <span className="platform-member-avatar" aria-hidden="true">
            {member.initials}
          </span>
          <span className="platform-team-copy">
            <strong>{member.name}</strong>
            <small>
              {member.spend} / {member.quota}
            </small>
          </span>
          <span className="platform-team-progress" aria-hidden="true">
            <i style={{ width: `${member.percent}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusVisual() {
  return (
    <div className="platform-status-visual" aria-label="当前响应 428 毫秒，二十八个可用性记录">
      <div className="platform-status-summary">
        <span className="platform-status-icon" aria-hidden="true">
          <Gauge className="size-4" />
        </span>
        <span>
          <strong>428ms</strong>
          <small>当前响应</small>
        </span>
      </div>
      <div className="platform-status-cells" aria-hidden="true">
        {statusCells.map((cell) => (
          <i key={cell} />
        ))}
      </div>
      <div className="platform-status-footer">
        <span>
          <Activity className="size-3.5" aria-hidden="true" />
          过去 28 次记录
        </span>
        <span className="platform-status-level">运行正常</span>
      </div>
    </div>
  );
}

function PlatformVisual({ kind }: { kind: (typeof marketingContent.platform)[number]['kind'] }) {
  switch (kind) {
    case 'routing':
      return <RoutingVisual />;
    case 'analytics':
      return <AnalyticsVisual />;
    case 'keys':
      return <KeysVisual />;
    case 'team':
      return <TeamVisual />;
    case 'status':
      return <StatusVisual />;
  }
}

export function PlatformSection() {
  return (
    <section id="platform" className="platform-section marketing-section" data-slot="platform-grid">
      <div className="marketing-shell">
        <SectionHeading
          id="platform-title"
          eyebrow="平台能力"
          title="一套平台，连接你的 AI 工作流。"
          description="接入、用量、密钥、团队和状态，按同一套规则协作。"
          align="center"
        />
        <div className="platform-grid">
          {marketingContent.platform.map((item, index) => (
            <a
              key={item.kind}
              href={item.href}
              className={`platform-card marketing-surface ${
                index === 0 ? 'platform-card-feature' : ''
              } ${index === 1 ? 'platform-card-tall' : ''}`}
              data-platform-kind={item.kind}
            >
              <GlowingEffect />
              <div className="platform-card-heading">
                <span className="platform-card-index">0{index + 1}</span>
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </div>
              <div className="platform-card-copy">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <PlatformVisual kind={item.kind} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
