import { Activity, ChartColumn, Layers, Wallet, type LucideIcon } from 'lucide-react';

import { ContainerScroll } from '../../components/effects/container-scroll';
import { marketingContent } from '../../content/marketing';

type StatIcon = (typeof marketingContent.dashboard.stats)[number]['icon'];

const statIcons: Record<StatIcon, LucideIcon> = {
  wallet: Wallet,
  activity: Activity,
  layers: Layers,
  chart: ChartColumn,
};

const dashboardSpend =
  marketingContent.dashboard.stats.find((stat) => stat.icon === 'chart')?.value ?? '—';

function TrendChart({ points }: { points: readonly number[] }) {
  const linePoints = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 640;
      const y = 164 - point * 1.35;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPoints = `0,180 ${linePoints} 640,180`;
  const lastPoint = points.at(-1) ?? 0;
  const lastX = 640;
  const lastY = 164 - lastPoint * 1.35;

  return (
    <svg
      className="dashboard-trend-chart"
      viewBox="0 0 640 180"
      role="img"
      aria-label="近七天消费趋势面积图"
    >
      <defs>
        <linearGradient id="dashboard-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" className="dashboard-chart-fill-start" />
          <stop offset="100%" className="dashboard-chart-fill-end" />
        </linearGradient>
      </defs>
      <g className="dashboard-chart-grid" aria-hidden="true">
        <line x1="0" x2="640" y1="42" y2="42" />
        <line x1="0" x2="640" y1="92" y2="92" />
        <line x1="0" x2="640" y1="142" y2="142" />
      </g>
      <polygon points={areaPoints} className="dashboard-trend-area" />
      <polyline points={linePoints} className="dashboard-trend-line" />
      <circle cx={lastX} cy={lastY} r="4" className="dashboard-trend-point" />
    </svg>
  );
}

function ModelDonut() {
  const segments = marketingContent.dashboard.models;

  return (
    <svg
      className="dashboard-donut-chart"
      viewBox="0 0 120 120"
      role="img"
      aria-label="模型消费占比环图"
    >
      <circle cx="60" cy="60" r="42" className="dashboard-donut-track" />
      {segments.map((model, index) => {
        const offset = segments
          .slice(0, index)
          .reduce((total, previousModel) => total + previousModel.percent, 0);
        return (
          <circle
            key={model.name}
            cx="60"
            cy="60"
            r="42"
            pathLength="100"
            strokeDasharray={`${model.percent} ${100 - model.percent}`}
            strokeDashoffset={-offset}
            className="dashboard-donut-segment"
            data-model={model.name}
          />
        );
      })}
      <text x="60" y="57" className="dashboard-donut-total">
        {dashboardSpend}
      </text>
      <text x="60" y="72" className="dashboard-donut-label">
        总消费
      </text>
    </svg>
  );
}

function ConsoleSidebar() {
  return (
    <aside className="dashboard-sidebar" aria-label="工作台导航">
      <div className="dashboard-sidebar-brand" aria-hidden="true">
        N
      </div>
      <nav>
        <a href="/console" className="is-active">
          <span className="dashboard-nav-dot" aria-hidden="true" />
          概览
        </a>
        <a href="/console/usage">
          <span className="dashboard-nav-dot" aria-hidden="true" />
          用量
        </a>
        <a href="/console/keys">
          <span className="dashboard-nav-dot" aria-hidden="true" />
          密钥
        </a>
        <a href="/console/team">
          <span className="dashboard-nav-dot" aria-hidden="true" />
          团队
        </a>
      </nav>
      <span className="dashboard-sidebar-user" aria-hidden="true">
        你
      </span>
    </aside>
  );
}

function DashboardStats() {
  return (
    <div className="dashboard-stats">
      {marketingContent.dashboard.stats.map((stat) => {
        const Icon = statIcons[stat.icon];
        return (
          <article className="dashboard-stat" key={stat.label}>
            <div className="dashboard-stat-heading">
              <span>{stat.label}</span>
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <strong>{stat.value}</strong>
          </article>
        );
      })}
    </div>
  );
}

function TrendPanel() {
  return (
    <article className="dashboard-chart-card dashboard-trend-panel">
      <div className="dashboard-panel-heading">
        <div>
          <p className="dashboard-panel-kicker">消费趋势</p>
          <h3>按天查看支出变化</h3>
        </div>
        <span className="dashboard-panel-value">{dashboardSpend}</span>
      </div>
      <TrendChart points={marketingContent.dashboard.trend} />
      <div className="dashboard-chart-axis" aria-hidden="true">
        <span>周一</span>
        <span>周三</span>
        <span>周五</span>
        <span>周日</span>
      </div>
    </article>
  );
}

function ModelBreakdownPanel() {
  return (
    <article className="dashboard-chart-card dashboard-breakdown-panel">
      <div className="dashboard-panel-heading">
        <div>
          <p className="dashboard-panel-kicker">模型分布</p>
          <h3>本周调用成本</h3>
        </div>
        <span className="dashboard-panel-more" aria-hidden="true">
          •••
        </span>
      </div>
      <ModelDonut />
      <ul className="dashboard-model-list">
        {marketingContent.dashboard.models.map((model) => (
          <li key={model.name}>
            <span className="dashboard-model-name">
              <span className="dashboard-model-dot" data-model={model.name} aria-hidden="true" />
              {model.name}
            </span>
            <span>{model.percent}%</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ModelCostRows() {
  return (
    <article className="dashboard-cost-card">
      <div className="dashboard-panel-heading">
        <div>
          <p className="dashboard-panel-kicker">模型费用</p>
          <h3>每一笔消费都有依据</h3>
        </div>
        <a href="/console/usage" className="dashboard-panel-link">
          查看明细 <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="dashboard-cost-rows">
        {marketingContent.dashboard.models.map((model) => (
          <div className="dashboard-cost-row" key={model.name}>
            <div className="dashboard-cost-label">
              <span className="dashboard-model-dot" data-model={model.name} aria-hidden="true" />
              <span>
                <strong>{model.name}</strong>
                <small>{model.tokens} tokens</small>
              </span>
            </div>
            <span className="dashboard-cost-value">{model.cost}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-preview" aria-label="工作台营销预览">
      <div className="dashboard-preview-topbar">
        <div className="dashboard-preview-breadcrumb">
          <span className="dashboard-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>工作台</strong>
          <span className="dashboard-breadcrumb-divider" aria-hidden="true">
            /
          </span>
          <span>概览</span>
        </div>
        <div className="dashboard-preview-period">
          <span className="dashboard-status-led" aria-hidden="true" />
          {marketingContent.dashboard.period}
          <span aria-hidden="true">⌄</span>
        </div>
      </div>
      <div className="dashboard-preview-body">
        <ConsoleSidebar />
        <main className="dashboard-preview-main">
          <div className="dashboard-main-heading">
            <div>
              <span className="dashboard-panel-kicker">周度概览</span>
              <h2>保持每次调用都清楚。</h2>
            </div>
            <span className="dashboard-main-date">{marketingContent.dashboard.period}</span>
          </div>
          <DashboardStats />
          <div className="dashboard-chart-grid">
            <TrendPanel />
            <ModelBreakdownPanel />
          </div>
          <ModelCostRows />
        </main>
      </div>
    </div>
  );
}

export function DashboardShowcase() {
  return (
    <section className="dashboard-showcase marketing-section" data-slot="dashboard-showcase">
      <div className="marketing-shell dashboard-showcase-shell">
        <ContainerScroll
          titleComponent={
            <span>
              一个工作台，<strong>看清每一次调用</strong>
            </span>
          }
        >
          <DashboardPreview />
        </ContainerScroll>
      </div>
    </section>
  );
}
