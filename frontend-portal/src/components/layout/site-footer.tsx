import { useTranslations } from 'next-intl';

import { Brand } from '@/components/layout/brand';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import { FOOTER_COLUMNS, SITE } from '@/lib/site';

const LINK_CLASS = 'text-sm text-muted-foreground transition-colors hover:text-foreground';

/** 页脚：品牌与版权、三列链接、底部超大水印字。列名只用作无障碍标签，不显示。 */
export function SiteFooter() {
  const t = useTranslations('common');

  return (
    <footer data-site-footer className="relative overflow-hidden border-t border-border">
      <Container className="flex flex-col gap-12 py-16 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <Brand />
          <p className="text-sm text-muted-foreground">
            © {SITE.copyrightYear} {SITE.name}
          </p>
          <p className="text-sm text-muted-foreground">{t('footer.rights')}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.key} aria-label={t(`footer.columns.${column.key}`)}>
              <ul className="space-y-4">
                {column.links.map((link) => (
                  <li key={link.key}>
                    {link.href.startsWith('/') ? (
                      <Link href={link.href} className={LINK_CLASS}>
                        {t(`footer.links.${link.key}`)}
                      </Link>
                    ) : (
                      <a href={link.href} className={LINK_CLASS}>
                        {t(`footer.links.${link.key}`)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>
      <p
        aria-hidden
        className="pointer-events-none select-none bg-gradient-to-b from-neutral-50 to-neutral-200 bg-clip-text pb-6 text-center text-[19vw] font-bold leading-[0.8] tracking-tighter text-transparent dark:from-neutral-950 dark:to-neutral-800 xl:text-[232px]"
      >
        {SITE.wordmark}
      </p>
    </footer>
  );
}
