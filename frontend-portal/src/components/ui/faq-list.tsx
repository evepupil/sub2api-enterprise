'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';

/** 常见问题手风琴：同一时间只展开一项，可以全部收起。 */
export function FaqList({
  items,
  className,
}: {
  items: readonly { q: string; a: string }[];
  className?: string;
}) {
  return (
    <Accordion.Root type="single" collapsible className={className}>
      {items.map((item, index) => (
        <Accordion.Item
          key={index}
          value={`faq-${index}`}
          data-faq-item={index}
          className="border-b border-border"
        >
          <Accordion.Header className="flex">
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium text-foreground">
              {item.q}
              <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-45" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-5 pr-10 text-sm leading-6 text-muted-foreground">
            {item.a}
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
