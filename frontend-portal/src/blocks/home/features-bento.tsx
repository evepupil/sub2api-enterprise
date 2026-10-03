import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { useTranslations } from 'next-intl';

import { FeaturesBentoChatCard } from './features-bento-chat-card';
import { FeaturesBentoGroupsCard } from './features-bento-groups-card';
import { FeaturesBentoImageCard } from './features-bento-image-card';
import { FeaturesBentoProtocolsCard } from './features-bento-protocols-card';

/**
 * 四格在 6 列网格里的占位与虚线分隔：第一行宽卡占 4 列、窄卡占 2 列，第二行各占 3 列。
 * 每格自带内边距和裁切，地球、渐隐层超出格子的部分靠 overflow-hidden 裁掉。
 */
const CELLS = [
  'relative overflow-hidden p-6 md:p-8 lg:col-span-4 border-b border-dashed border-border-strong lg:border-r',
  'relative overflow-hidden p-6 md:p-8 lg:col-span-2 border-b border-dashed border-border-strong',
  'relative overflow-hidden p-6 md:p-8 lg:col-span-3 border-b border-dashed border-border-strong lg:border-b-0 lg:border-r',
  'relative overflow-hidden p-6 md:p-8 lg:col-span-3',
] as const;

/** H4 能力拼贴：模板「Packed with features」同款，虚线分隔的四格，每格标题加一块视觉。 */
export function FeaturesBento() {
  const t = useTranslations('homeShowcase.features');

  return (
    <section id="features" className="py-20 md:py-28">
      <Container>
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-16 grid grid-cols-1 border-y border-dashed border-border-strong md:border-x lg:grid-cols-6">
          <div className={CELLS[0]}>
            <FeaturesBentoImageCard />
          </div>
          <div className={CELLS[1]}>
            <FeaturesBentoChatCard />
          </div>
          <div className={CELLS[2]}>
            <FeaturesBentoGroupsCard />
          </div>
          <div className={CELLS[3]}>
            <FeaturesBentoProtocolsCard />
          </div>
        </div>
      </Container>
    </section>
  );
}

export default FeaturesBento;
