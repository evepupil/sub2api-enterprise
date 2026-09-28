import { Card } from '../../components/ui/card';
import type { CatalogModel } from '../public/types';
import { formatPrice } from './format';

const LOCAL_PROVIDER_LOGOS: Readonly<Record<string, string>> = {
  anthropic: '/providers/anthropic.svg',
  google: '/providers/google.svg',
  openai: '/providers/openai.svg',
};

const PRICE_LABELS = [
  { key: 'input', label: '输入' },
  { key: 'cacheWrite', label: '缓存写入' },
  { key: 'cacheRead', label: '缓存读取' },
  { key: 'output', label: '输出' },
] as const;

export interface ModelCardProps {
  model: CatalogModel;
}

export function ModelCard({ model }: ModelCardProps) {
  const logo = LOCAL_PROVIDER_LOGOS[model.providerKey.trim().toLowerCase()];
  const initial = model.provider.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <article className="catalog-model-card min-w-0">
      <Card className="catalog-model-surface h-full min-w-0 gap-0 rounded-card p-5 shadow-none">
        <div className="catalog-provider-row">
          <span className="catalog-provider-mark">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- These are bundled local provider SVGs, never user-supplied URLs.
              <img src={logo} alt="" aria-hidden="true" className="size-9 shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
              >
                {initial}
              </span>
            )}
          </span>
          <p className="catalog-provider-name min-w-0 break-words">{model.provider}</p>
        </div>

        <h2 className="catalog-model-name break-words">{model.id}</h2>

        <dl className="catalog-price-grid border-t border-border">
          {PRICE_LABELS.map(({ key, label }) => (
            <div key={key} className="catalog-price-item min-w-0">
              <dt>{label}</dt>
              <dd className="break-words tabular-nums">{formatPrice(model.prices[key])}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </article>
  );
}
