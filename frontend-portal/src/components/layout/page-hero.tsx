import type { ReactNode } from 'react';

import { GridBeams } from '@/components/effects/grid-beams';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { cn } from '@/lib/utils';

/** 内页页首：网格光线背景加居中大标题，模型、价格、分组三页共用。children 放标题下面的操作区。 */
export function PageHero({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn('relative overflow-hidden pt-16 pb-12 md:pt-24 md:pb-16', className)}
    >
      <GridBeams />
      <Container className="relative">
        <SectionHeading as="h1" title={title} subtitle={subtitle} />
        {children ? <div className="mt-8 flex flex-col items-center gap-5">{children}</div> : null}
      </Container>
    </section>
  );
}
