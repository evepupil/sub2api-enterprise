import { KeyRound } from 'lucide-react';

import { GlowingEffect } from '../../components/effects/glowing-effect';
import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';

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
          <p className="marketing-eyebrow">{marketingContent.sections.providers.eyebrow}</p>
          <h2 id="provider-strip-title">{marketingContent.sections.providers.title}</h2>
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

/** models：多模型统一接入，沿用请求分发到多家模型厂家的路由示意。 */
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

const keyLimitTags = ['额度', '有效期', '5 小时限速', 'IP 白名单'] as const;

/** access：访问控制，沿用密钥示意，附加限制项标签。 */
function KeysVisual() {
  const keys = [
    { label: '研发应用', value: 'sk-••••••••', status: '活跃' },
    { label: '内容助手', value: 'sk-••••••••', status: '活跃' },
    { label: '实验项目', value: 'sk-••••••••', status: '待用' },
  ] as const;

  return (
    <div
      className="platform-keys-visual"
      aria-label="三个按应用分配的脱敏密钥，可设置额度、有效期、限速与 IP 白名单"
    >
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
      <div className="platform-key-tags" aria-hidden="true">
        {keyLimitTags.map((tag) => (
          <span key={tag} className="platform-key-tag">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/** organization：组织账户体系，沿用团队成员与配额示意。 */
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

const failoverAccounts = [
  { label: '账号 A', status: '已隔离', tone: 'warning' },
  { label: '账号 B', status: '调度中', tone: 'success' },
  { label: '账号 C', status: '备用', tone: 'neutral' },
] as const;

/** availability：高可用调度，改为故障切换示意——三个上游账号，语义色区分状态。 */
function FailoverVisual() {
  return (
    <div
      className="platform-failover-visual"
      aria-label="账号 A 已隔离，账号 B 调度中，账号 C 备用"
    >
      {failoverAccounts.map((account) => (
        <div className="platform-failover-row" data-tone={account.tone} key={account.label}>
          <span className="platform-failover-dot" aria-hidden="true" />
          <span className="platform-failover-label">{account.label}</span>
          <span className="platform-failover-status">{account.status}</span>
        </div>
      ))}
    </div>
  );
}

const streamChunks = Array.from({ length: 6 }, (_, index) => index);

/** latency：低延迟转发，改为流式逐段到达示意。 */
function StreamVisual() {
  return (
    <div className="platform-stream-visual" aria-label="响应内容按事件逐段转发">
      <div className="platform-stream-row" aria-hidden="true">
        {streamChunks.map((chunk) => (
          <span key={chunk} />
        ))}
        <i className="platform-stream-cursor" />
      </div>
      <div className="platform-stream-meta">
        <span className="platform-stream-dot" aria-hidden="true" />
        <span>逐事件转发</span>
      </div>
    </div>
  );
}

/** deployment：独立部署，客户环境边框内放网关与数据两个方块。 */
function DeploymentVisual() {
  return (
    <div className="platform-deploy-visual" aria-label="客户环境内部署网关与数据">
      <div className="platform-deploy-frame">
        <span className="platform-deploy-frame-label">客户环境</span>
        <div className="platform-deploy-blocks">
          <span className="platform-deploy-block">网关</span>
          <span className="platform-deploy-block">数据</span>
        </div>
      </div>
    </div>
  );
}

function PlatformVisual({
  kind,
}: {
  kind: (typeof marketingContent.capabilities)[number]['kind'];
}) {
  switch (kind) {
    case 'availability':
      return <FailoverVisual />;
    case 'latency':
      return <StreamVisual />;
    case 'access':
      return <KeysVisual />;
    case 'organization':
      return <TeamVisual />;
    case 'models':
      return <RoutingVisual />;
    case 'deployment':
      return <DeploymentVisual />;
  }
}

export function PlatformSection() {
  const heading = marketingContent.sections.capabilities;

  return (
    <section
      id="platform"
      className="platform-section marketing-section"
      data-slot="platform-grid"
      aria-labelledby="platform-title"
    >
      <div className="marketing-shell">
        <SectionHeading
          id="platform-title"
          eyebrow={heading.eyebrow}
          title={heading.title}
          align="center"
        />
        <div className="platform-grid">
          {marketingContent.capabilities.map((item, index) => (
            <article
              key={item.kind}
              className="platform-card marketing-surface"
              data-platform-kind={item.kind}
            >
              <GlowingEffect />
              <div className="platform-card-heading">
                <span className="platform-card-index">0{index + 1}</span>
              </div>
              <div className="platform-card-copy">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <PlatformVisual kind={item.kind} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
