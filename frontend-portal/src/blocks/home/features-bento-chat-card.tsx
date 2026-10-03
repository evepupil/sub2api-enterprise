import { useTranslations } from 'next-intl';

/** 用户消息的模型调用名，与回复气泡一一对应（专有名词，不进文案文件）。 */
const REPLIES: readonly { model: string; key: 'm2' | 'm4' | 'm6' }[] = [
  { model: 'claude-sonnet-5-5', key: 'm2' },
  { model: 'gpt-6-sol', key: 'm4' },
  { model: 'gpt-image-2', key: 'm6' },
];

const USER_KEYS = ['m1', 'm3', 'm5'] as const;

/** B 换模型卡：一部手机样机，里面三问三答，回复气泡上标注所用模型。 */
export function FeaturesBentoChatCard() {
  const t = useTranslations('homeShowcase.features.chatCard');

  return (
    <div>
      <h3 className="text-xl font-medium tracking-tight text-foreground md:text-2xl">
        {t('title')}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground md:text-base">{t('desc')}</p>
      <div className="relative mt-8 h-[300px] md:h-[340px]">
        <div className="mx-auto h-full w-full max-w-[280px] rounded-t-[40px] border-x-[6px] border-t-[6px] border-muted bg-card px-3 pt-3 shadow-card">
          <div aria-hidden className="mx-auto h-5 w-20 rounded-full bg-muted" />
          <div className="mt-4 space-y-2.5">
            {USER_KEYS.map((userKey, i) => {
              const reply = REPLIES[i];
              if (!reply) return null;
              return (
                <div key={userKey}>
                  <p className="max-w-[85%] rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-foreground">
                    {t(`messages.${userKey}`)}
                  </p>
                  <p className="mb-1 text-right font-mono text-[10px] text-subtle-foreground">
                    {reply.model}
                  </p>
                  <p className="ml-auto max-w-[85%] rounded-xl bg-primary px-3 py-2 text-xs leading-5 text-primary-foreground">
                    {t(`messages.${reply.key}`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        {/* 手机底部被卡片裁掉，加一层渐隐和模板一致 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background"
        />
      </div>
    </div>
  );
}
