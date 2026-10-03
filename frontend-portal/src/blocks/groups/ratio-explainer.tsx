import { useTranslations } from 'next-intl';

import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';

import { RatioExplainerExamples } from './ratio-explainer-examples';

/** 倍率说明：左栏公式卡，右栏三个版本并排的计算示例表。 */
export function RatioExplainer() {
  const t = useTranslations('groups');

  return (
    <section id="ratio" className="bg-surface py-20 md:py-28">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="lg:self-start">
          <SectionHeading align="left" title={t('ratio.title')} subtitle={t('ratio.subtitle')} />
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
            {/* 公式行：等号和乘号弱化成灰色，变量保持正文色 */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-medium text-foreground md:text-xl">
              <span>{t('ratio.billed')}</span>
              <span className="text-subtle-foreground">=</span>
              <span>{t('ratio.base')}</span>
              <span className="text-subtle-foreground">×</span>
              <span>{t('ratio.ratio')}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t('ratio.baseNote')}</p>
          </div>
        </div>
        <RatioExplainerExamples />
      </Container>
    </section>
  );
}

export default RatioExplainer;
