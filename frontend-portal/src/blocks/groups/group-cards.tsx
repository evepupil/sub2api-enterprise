'use client';

import { Container } from '@/components/ui/container';
import { useEdition } from '@/lib/use-catalog-state';
import { groupsFor } from '@/lib/catalog';

import { GroupCardsCard } from './group-cards-card';

/** 分组卡：当前版本的四个分组并排，第三张（Claude 专线）是深蓝重点卡。 */
export function GroupCards() {
  const [edition] = useEdition();
  const groups = groupsFor(edition);

  return (
    <section id="group-cards" className="pb-20 md:pb-28">
      <Container>
        {/* 默认拉伸等高：卡片 flex h-full flex-col，按钮 mt-auto 靠底 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {groups.map((group) => (
            <GroupCardsCard key={group.id} group={group} edition={edition} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export default GroupCards;
