import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Align = 'center' | 'left';

const OUTER: Record<Align, string> = {
  center: 'mx-auto max-w-3xl text-center',
  left: 'max-w-3xl text-left',
};

const SUBTITLE: Record<Align, string> = {
  center: 'mx-auto max-w-2xl text-balance text-base text-muted-foreground',
  left: 'max-w-2xl text-balance text-base text-muted-foreground',
};

const TITLE =
  'text-balance text-3xl font-medium tracking-tight text-foreground md:text-5xl md:leading-[1.25]';

/** 内页标题 / 区块标题：一个标题加可选的一行副标题。 */
export function SectionHeading({
  title,
  subtitle,
  align = 'center',
  as: Heading = 'h2',
  className,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  align?: Align;
  as?: 'h1' | 'h2';
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn(OUTER[align], className)}>
      <Heading id={id} className={TITLE}>
        {title}
      </Heading>
      {subtitle ? <p className={cn('mt-4', SUBTITLE[align])}>{subtitle}</p> : null}
    </div>
  );
}
