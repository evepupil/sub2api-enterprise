import { ProviderLogo } from '@/components/catalog/provider-logo';
import type { ProviderId } from '@/lib/catalog';
import { useTranslations } from 'next-intl';

/** 右侧展示区叠放的厂商，顺序即规格指定 */
const SHOWCASE_PROVIDERS: readonly ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'moonshot',
  'qwen',
];

/** 登录注册右半屏：浅灰底、虚线框，中心是厂商标志叠放和一句话说明。lg 以下不渲染。 */
export function AuthShowcase() {
  const t = useTranslations('auth');

  return (
    <aside
      id="auth-showcase"
      className="relative hidden overflow-hidden border-l border-border bg-surface lg:flex lg:items-center lg:justify-center"
    >
      {/* 模板同款的虚线大框，纯装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-10 rounded-2xl border border-dashed border-border-strong"
      />
      <div className="relative max-w-md px-10 text-center">
        <div className="flex justify-center -space-x-3">
          {SHOWCASE_PROVIDERS.map((provider) => (
            <span
              key={provider}
              className="flex size-12 items-center justify-center rounded-full border-2 border-surface bg-card shadow-card"
            >
              <ProviderLogo provider={provider} size={24} />
            </span>
          ))}
        </div>
        <h2 className="mt-8 text-xl font-semibold tracking-tight text-foreground">
          {t('showcase.title')}
        </h2>
        <p className="mt-4 text-base text-muted-foreground">{t('showcase.subtitle')}</p>
      </div>
    </aside>
  );
}

export default AuthShowcase;
