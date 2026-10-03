import { useLocale, useTranslations } from 'next-intl';

import { Container } from '@/components/ui/container';
import type { AppLocale } from '@/i18n/routing';
import { SITE } from '@/lib/site';

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/** 截图的 CSS 尺寸（按 2 倍导出）；改截图尺寸时两边一起改 */
const SHOT_SIZE = {
  desktop: { width: 1280, height: 860 },
  mobile: { width: 375, height: 720 },
} as const;

const shotSrc = (locale: AppLocale, theme: Theme, device: keyof typeof SHOT_SIZE) =>
  `/home/console-${locale}-${theme}-${device}.webp`;

/**
 * 首屏下方的控制台画面：控制台用量页的真实截图（占位数据），放在大圆角外框里，下半部渐隐。
 * 每种语言备浅色、深色两套，各有桌面与手机两张：md 以上用桌面截图，以下用手机截图。
 * 两套都设成懒加载，不显示的那套（display: none）不会下载。截图由本机脚本从控制台拍，控制台改版后重拍。
 */
export function ConsolePreview() {
  const t = useTranslations('homeHero.preview');
  const locale = useLocale() as AppLocale;

  return (
    <section id="preview" className="relative pb-20 md:pb-28">
      <Container>
        <div
          data-console-preview
          className="relative mx-auto max-w-6xl rounded-[32px] border border-border bg-muted/70 p-2 shadow-card md:p-3"
        >
          <div className="relative h-[540px] overflow-hidden rounded-[24px] border border-border bg-card md:h-[620px]">
            {THEMES.map((theme) => (
              <picture
                key={theme}
                className={
                  theme === 'dark' ? 'hidden size-full dark:block' : 'block size-full dark:hidden'
                }
              >
                <source
                  media="(min-width: 768px)"
                  srcSet={shotSrc(locale, theme, 'desktop')}
                  width={SHOT_SIZE.desktop.width}
                  height={SHOT_SIZE.desktop.height}
                />
                <img
                  src={shotSrc(locale, theme, 'mobile')}
                  alt={t('alt', { name: SITE.name })}
                  width={SHOT_SIZE.mobile.width}
                  height={SHOT_SIZE.mobile.height}
                  loading="lazy"
                  decoding="async"
                  data-preview-shot={theme}
                  className="size-full object-cover object-left-top"
                />
              </picture>
            ))}
          </div>
          {/* 画面下半部慢慢淡出，和模板首屏下方的截图一致 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 rounded-b-[32px] bg-gradient-to-b from-transparent to-background"
          />
        </div>
      </Container>
    </section>
  );
}

export default ConsolePreview;
