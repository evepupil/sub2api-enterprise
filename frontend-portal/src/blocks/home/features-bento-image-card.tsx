import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/** 六条提示词记录的模型调用名（专有名词，不进文案文件），与提示词文案 p1…p6 一一对应。 */
const PROMPT_MODELS = [
  'gpt-image-2',
  'gemini-3-pro-image',
  'gpt-image-2.5-sunburst',
  'gemini-3.1-flash-image',
  'gpt-image-2.5-flare',
  'gemini-2.5-flash-image',
] as const;

const PROMPT_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

/** 展示卡：微倾斜叠放，悬停回正并放大一点。 */
function ShowcaseImage(props: { src: string; alt: string; className: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-2 shadow-card transition-transform duration-200 hover:rotate-0 hover:scale-[1.02]',
        props.className,
      )}
    >
      <img
        src={props.src}
        alt={props.alt}
        width={224}
        height={224}
        loading="lazy"
        decoding="async"
        className="size-44 rounded-xl object-cover md:size-56"
      />
    </div>
  );
}

/** A 生图卡：左边提示词记录向右淡出，右边叠两张生成的图片。 */
export function FeaturesBentoImageCard() {
  const t = useTranslations('homeShowcase.features.imageCard');

  return (
    <div>
      <h3 className="text-xl font-medium tracking-tight text-foreground md:text-2xl">
        {t('title')}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground md:text-base">{t('desc')}</p>
      <div className="relative mt-8 h-[300px] md:h-[340px]">
        <div className="absolute inset-y-0 left-0 w-full space-y-5 [mask-image:linear-gradient(to_right,black_30%,transparent_75%)] md:w-3/4">
          {PROMPT_KEYS.map((key, i) => {
            const model = PROMPT_MODELS[i];
            if (!model) return null;
            return (
              <div key={key} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-full bg-gradient-to-br from-muted to-border-strong"
                />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {t(`prompts.${key}`)}
                  </p>
                  <p className="font-mono text-[11px] text-subtle-foreground">{model}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute right-0 top-0 flex w-full flex-col items-end md:w-auto">
          <ShowcaseImage
            src="/showcase/01-architecture.webp"
            alt={t('prompts.p1')}
            className="rotate-[-4deg]"
          />
          <ShowcaseImage
            src="/showcase/02-portrait.webp"
            alt={t('prompts.p2')}
            className="hidden -mt-24 mr-10 rotate-[3deg] lg:block"
          />
        </div>
      </div>
    </div>
  );
}
