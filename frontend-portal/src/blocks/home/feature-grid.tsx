import { CodeXml, FileText, Gauge, Layers, Receipt, RefreshCw, Users, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils';

/** 8 格配置：key 对应 homeMore.capabilities.<key> 的文案，图标来自 lucide 白名单 */
const FEATURES = [
  { key: 'developers', Icon: CodeXml },
  { key: 'latency', Icon: Zap },
  { key: 'billing', Icon: Receipt },
  { key: 'editions', Icon: Gauge },
  { key: 'failover', Icon: RefreshCw },
  { key: 'organizations', Icon: Users },
  { key: 'ratios', Icon: Layers },
  { key: 'invoices', Icon: FileText },
] as const;

export function FeatureGrid() {
  const t = useTranslations('homeMore');

  return (
    <section id="capabilities" className="py-20 md:py-28">
      <Container>
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, Icon }, i) => (
            <div
              key={key}
              data-feature={key}
              className={cn(
                'group/feature relative flex flex-col border-border py-10 lg:border-r',
                (i === 0 || i === 4) && 'lg:border-l',
                i < 4 && 'lg:border-b',
              )}
            >
              {/* 悬停底色：上行用自下而上的渐变，下行相反 */}
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 h-full w-full opacity-0 transition duration-200 group-hover/feature:opacity-100',
                  i < 4
                    ? 'bg-gradient-to-t from-muted to-transparent'
                    : 'bg-gradient-to-b from-muted to-transparent',
                )}
              />
              <div className="relative z-10 mb-4 px-10 text-muted-foreground">
                <Icon className="size-6" />
              </div>
              <div className="relative z-10 mb-2 px-10 text-lg font-bold">
                {/* 悬停时左侧竖条变长变深，标题跟着右移 */}
                <div className="absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-br-full rounded-tr-full bg-border-strong transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-primary" />
                <span className="inline-block text-foreground transition duration-200 group-hover/feature:translate-x-2">
                  {t(`capabilities.${key}.title`)}
                </span>
              </div>
              <p className="relative z-10 max-w-xs px-10 text-sm text-muted-foreground">
                {t(`capabilities.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export default FeatureGrid;
