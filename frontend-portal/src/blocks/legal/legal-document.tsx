import { Fragment } from 'react';

import { PageHero } from '@/components/layout/page-hero';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import { type LegalBlock, type LegalInline, parseBlocks, parseInline } from '@/lib/legal/markup';
import { SITE } from '@/lib/site';
import type { Messages } from '@/messages';

/** 一篇条款（服务条款或隐私政策），结构由 legal.json 决定 */
export type LegalDoc = Messages['legal']['terms'];

const LINK_CLASS = 'text-foreground underline underline-offset-4 hover:text-foreground/80';

function Inlines({ parts }: { parts: LegalInline[] }) {
  return parts.map((part, index) => {
    switch (part.kind) {
      case 'strong':
        return (
          <strong key={index} className="font-medium text-foreground">
            {part.text}
          </strong>
        );
      case 'link':
        return (
          <Link key={index} href={part.href} className={LINK_CLASS}>
            {part.text}
          </Link>
        );
      case 'email':
        return (
          <a key={index} href={`mailto:${SITE.supportEmail}`} className={LINK_CLASS}>
            {SITE.supportEmail}
          </a>
        );
      case 'name':
        return <Fragment key={index}>{SITE.name}</Fragment>;
      default:
        return <Fragment key={index}>{part.text}</Fragment>;
    }
  });
}

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return blocks.map((block, index) =>
    block.kind === 'list' ? (
      <ul key={index} className="list-disc space-y-2 pl-5 marker:text-subtle-foreground">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <Inlines parts={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={index}>
        <Inlines parts={block.inlines} />
      </p>
    ),
  );
}

/**
 * 条款页：内页页首（标题、最近更新）加窄栏正文。每节带编号和锚点（如 /terms#refund），
 * 锚点留出顶栏的高度。正文只在服务端渲染，legal 文案不发给浏览器。
 */
export function LegalDocument({ id, doc }: { id: 'terms' | 'privacy'; doc: LegalDoc }) {
  return (
    <>
      <PageHero id={`${id}-hero`} title={doc.title} subtitle={doc.updated} />
      <Container className="max-w-3xl pb-24 md:pb-32">
        <article data-legal={id} className="text-base leading-7 text-muted-foreground">
          <div className="space-y-4">
            {doc.intro.map((line, index) => (
              <p key={index}>
                <Inlines parts={parseInline(line)} />
              </p>
            ))}
          </div>
          {doc.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="mt-12 scroll-mt-28"
            >
              <h2
                id={`${section.id}-title`}
                className="text-xl font-medium tracking-tight text-foreground md:text-2xl"
              >
                {index + 1}. {section.title}
              </h2>
              <div className="mt-4 space-y-4">
                <Blocks blocks={parseBlocks(section.body)} />
              </div>
            </section>
          ))}
        </article>
      </Container>
    </>
  );
}
