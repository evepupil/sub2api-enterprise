import { Button } from '../../components/ui/button';
import { ContainerScroll } from '../../components/effects/container-scroll';
import { Spotlight } from '../../components/effects/spotlight';
import { ModelCard } from '../catalog/model-card';
import type { CatalogData, PublicResult, PublicSiteData } from '../public/types';

interface HomeViewProps {
  catalog: PublicResult<CatalogData>;
  site: PublicSiteData;
}

function ActionLink({
  href,
  children,
  variant = 'outline',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'default' | 'outline';
}) {
  return (
    <Button asChild variant={variant}>
      <a href={href}>{children}</a>
    </Button>
  );
}

function CatalogSection({ catalog }: { catalog: PublicResult<CatalogData> }) {
  if (catalog.kind !== 'ready') {
    const message = {
      unavailable: '模型目录暂时不可用。',
      disabled: '模型目录暂未开放。',
      'authentication-required': '登录后查看模型目录。',
    }[catalog.kind];

    return (
      <section className="marketing-section marketing-shell" aria-labelledby="model-section-title">
        <div className="marketing-section-heading">
          <h2 id="model-section-title">模型与价格</h2>
          <span className="marketing-kicker">美元 / 百万 Token</span>
        </div>
        <p className="marketing-state">{message}</p>
      </section>
    );
  }

  const models = catalog.data.models.slice(0, 3);

  return (
    <section className="marketing-section marketing-shell" aria-labelledby="model-section-title">
      <div className="marketing-section-heading">
        <h2 id="model-section-title">模型与价格</h2>
        <div className="marketing-heading-actions">
          <span className="marketing-kicker">美元 / 百万 Token</span>
          <a href="/catalog">查看全部模型</a>
        </div>
      </div>
      {models.length > 0 ? (
        <div className="marketing-model-grid">
          {models.map((model) => (
            <ModelCard key={`${model.providerKey}:${model.id}`} model={model} />
          ))}
        </div>
      ) : (
        <p className="marketing-state">暂无可用模型。</p>
      )}
    </section>
  );
}

export function HomeView({ catalog }: HomeViewProps) {
  const helpHref = '/help';

  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-grid" />
        <Spotlight />
        <div className="marketing-shell marketing-hero-content">
          <p className="marketing-eyebrow">个人与团队的模型服务</p>
          <h1>主流模型，统一接入与计费。</h1>
          <p className="marketing-lede">按量计费 · 密钥管理 · 团队配额</p>
          <div className="marketing-actions">
            <ActionLink href="/catalog" variant="default">
              查看模型
            </ActionLink>
            <ActionLink href={helpHref}>查看接入说明</ActionLink>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-preview" aria-labelledby="preview-title">
        <ContainerScroll titleComponent={<span id="preview-title">控制台界面示意</span>}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Local static illustration is intentionally usable in offline previews. */}
          <img
            src="/illustrations/dashboard-preview.png"
            alt="控制台示例布局示意图，不代表真实业务数据"
          />
        </ContainerScroll>
      </section>

      <CatalogSection catalog={catalog} />

      <section
        className="marketing-section marketing-shell marketing-access-grid"
        aria-label="接入与账户"
      >
        <div className="marketing-access-block">
          <h2>开始使用</h2>
          <ol className="marketing-steps">
            <li>
              <span className="marketing-step-number">1</span>
              <span>选择模型</span>
            </li>
            <li>
              <span className="marketing-step-number">2</span>
              <span>创建密钥</span>
            </li>
            <li>
              <span className="marketing-step-number">3</span>
              <span>充值后调用</span>
            </li>
          </ol>
          <a className="marketing-inline-link" href={helpHref}>
            查看接入说明
          </a>
        </div>
        <div className="marketing-access-block">
          <h2>个人与团队</h2>
          <ul className="marketing-capabilities">
            <li>个人密钥与用量</li>
            <li>组织成员与消费配额</li>
            <li>按成员查看费用</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
