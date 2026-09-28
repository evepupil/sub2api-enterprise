import { ArrowUpRight } from 'lucide-react';

import { SectionHeading } from '../../components/marketing/section-heading';
import { marketingContent } from '../../content/marketing';
import { formatPrice } from '../catalog/format';
import type { CatalogData, CatalogModel, PublicResult } from '../public/types';

interface ModelPreviewProps {
  catalog: PublicResult<CatalogData>;
}

const priceLabels = [
  { key: 'input', label: '输入' },
  { key: 'cacheWrite', label: '缓存写入' },
  { key: 'cacheRead', label: '缓存读取' },
  { key: 'output', label: '输出' },
] as const;

const providerLogos: Readonly<Record<string, string>> = {
  anthropic: '/providers/anthropic.svg',
  google: '/providers/google.svg',
  openai: '/providers/openai.svg',
};

function ProviderBadge({ model }: { model: CatalogModel }) {
  const logo = providerLogos[model.providerKey.trim().toLowerCase()];
  const initial = model.provider.trim().slice(0, 1).toUpperCase() || '?';

  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- Provider marks are local, bundled assets.
    <img className="model-preview-provider-logo" src={logo} alt="" aria-hidden="true" />
  ) : (
    <span className="model-preview-provider-initial" aria-hidden="true">
      {initial}
    </span>
  );
}

function AvailabilityState({ kind }: { kind: PublicResult<CatalogData>['kind'] }) {
  const state = {
    ready: '目录可见',
    unavailable: '暂时无法加载',
    disabled: '目录未开放',
    'authentication-required': '需要登录',
  }[kind];

  return <span className={`model-preview-state model-preview-state-${kind}`}>{state}</span>;
}

function ModelPriceCard({ model }: { model: CatalogModel }) {
  return (
    <article className="model-preview-card marketing-surface">
      <header className="model-preview-card-header">
        <div className="model-preview-provider">
          <ProviderBadge model={model} />
          <span>{model.provider}</span>
        </div>
        <span className="model-preview-live-dot" aria-hidden="true" />
      </header>
      <h3>{model.id}</h3>
      <AvailabilityState kind="ready" />
      <dl className="model-preview-prices">
        {priceLabels.map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{formatPrice(model.prices[key])}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function CatalogState({ catalog }: ModelPreviewProps) {
  const messages = {
    unavailable: '模型目录暂时不可用。',
    disabled: '模型目录暂未开放。',
    'authentication-required': '登录后查看模型目录。',
  } as const;

  if (catalog.kind === 'ready') {
    return (
      <div className="model-preview-empty">
        <AvailabilityState kind="ready" />
        <span>暂无公开模型。</span>
        <a href="/catalog">
          前往模型目录 <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="model-preview-empty">
      <AvailabilityState kind={catalog.kind} />
      <span>{messages[catalog.kind]}</span>
      <a href="/catalog">
        打开模型目录 <ArrowUpRight className="size-4" aria-hidden="true" />
      </a>
    </div>
  );
}

export function ModelPreview({ catalog }: ModelPreviewProps) {
  const models = catalog.kind === 'ready' ? catalog.data.models.slice(0, 6) : [];

  return (
    <section id="models" className="model-preview marketing-section" data-slot="model-preview">
      <div className="marketing-shell">
        <div className="model-preview-heading">
          <SectionHeading
            id="model-preview-title"
            eyebrow={marketingContent.sections.models.eyebrow}
            title={marketingContent.sections.models.title}
            description={marketingContent.sections.models.description}
          />
          <a className="model-preview-catalog-link" href="/catalog">
            查看全部模型 <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>

        {models.length > 0 ? (
          <div className="model-preview-grid">
            {models.map((model) => (
              <ModelPriceCard key={`${model.providerKey}:${model.id}`} model={model} />
            ))}
          </div>
        ) : (
          <CatalogState catalog={catalog} />
        )}
      </div>
    </section>
  );
}
