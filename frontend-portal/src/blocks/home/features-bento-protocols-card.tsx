'use client';

import { Braces, SquareTerminal, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Globe } from '@/components/effects/globe';
import { Marquee } from '@/components/effects/marquee';

/** 三行跑马灯里的胶囊内容（专有名词，不进文案文件）。 */
const PROTOCOL_ITEMS = [
  'OpenAI Chat Completions',
  'OpenAI Responses',
  'Anthropic Messages',
  'Gemini API',
  'OpenAI Images',
] as const;

const TOOL_ITEMS = [
  'Claude Code',
  'Codex CLI',
  'Gemini CLI',
  'Cursor',
  'Cline',
  'Cherry Studio',
] as const;

const FRAMEWORK_ITEMS = [
  'LangChain',
  'LlamaIndex',
  'Dify',
  'n8n',
  'Vercel AI SDK',
  'OpenAI SDK',
] as const;

/** 一行跑马灯：每行三个属性对应规格里的第 1、2、3 行。 */
const MARQUEE_ROWS: readonly {
  icon: LucideIcon;
  direction: 'left' | 'right';
  duration: number;
  items: readonly string[];
}[] = [
  { icon: Braces, direction: 'left', duration: 36, items: PROTOCOL_ITEMS },
  { icon: SquareTerminal, direction: 'right', duration: 40, items: TOOL_ITEMS },
  { icon: Workflow, direction: 'left', duration: 44, items: FRAMEWORK_ITEMS },
];

/** D 协议卡：右下角一个地球，上面三行反向流动的胶囊跑马灯。 */
export function FeaturesBentoProtocolsCard() {
  const t = useTranslations('homeShowcase.features.protocolsCard');

  return (
    <div>
      <h3 className="text-xl font-medium tracking-tight text-foreground md:text-2xl">
        {t('title')}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground md:text-base">{t('desc')}</p>
      <div className="relative mt-8 h-[300px] md:h-[340px]">
        {/* 地球定位在右下角，一部分被格子边缘裁掉（格子自带 overflow-hidden），和模板一致 */}
        <div className="absolute -bottom-40 -right-24 w-[420px] md:-bottom-48 md:w-[520px]">
          <Globe />
        </div>
        <div className="absolute inset-x-0 top-6 space-y-4">
          {MARQUEE_ROWS.map((row, i) => {
            const Icon = row.icon;
            return (
              <Marquee key={i} direction={row.direction} duration={row.duration}>
                {row.items.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-card"
                  >
                    <Icon aria-hidden className="size-3.5 text-muted-foreground" />
                    {item}
                  </span>
                ))}
              </Marquee>
            );
          })}
        </div>
      </div>
    </div>
  );
}
