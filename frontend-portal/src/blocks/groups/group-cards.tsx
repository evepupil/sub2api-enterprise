import { Container } from '@/components/ui/container';
import { EDITIONS } from '@/lib/catalog';

import { GroupCardsCard } from './group-cards-card';

/** 通道卡：三种通道就是三个分组，并排三张，专用通道是深蓝重点卡，企业通道联系客服。 */
export function GroupCards() {
  return (
    <section id="group-cards" className="pb-20 md:pb-28">
      <Container>
        {/* 默认拉伸等高：卡片 flex h-full flex-col，按钮 mt-auto 靠底；大屏以下单列并收窄 */}
        <div className="mx-auto grid max-w-md gap-6 lg:max-w-6xl lg:grid-cols-3 lg:gap-4">
          {EDITIONS.map((edition, index) => (
            <GroupCardsCard key={edition.id} edition={edition} previous={EDITIONS[index - 1]} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export default GroupCards;
