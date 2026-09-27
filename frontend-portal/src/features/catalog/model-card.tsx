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
    <article className="min-w-0">
      <Card className="h-full min-w-0 gap-0 rounded-card p-5 shadow-none">
        <div className="flex min-w-0 items-center gap-3">
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
          <p className="min-w-0 break-words text-base font-semibold text-foreground [overflow-wrap:anywhere]">
            {model.provider}
          </p>
        </div>

        <h2 className="mt-3 break-words text-lg font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
          {model.id}
        </h2>

        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
          {PRICE_LABELS.map(({ key, label }) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-base leading-snug tabular-nums text-foreground [overflow-wrap:anywhere]">
                {formatPrice(model.prices[key])}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </article>
  );
}
