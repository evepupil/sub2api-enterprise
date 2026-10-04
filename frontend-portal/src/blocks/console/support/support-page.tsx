'use client';

import { Mail, MessageCircle, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ConsolePage } from '@/components/console/console-page';
import { CopyButton } from '@/components/console/copy-button';
import { Panel } from '@/components/console/panel';
import { SITE } from '@/lib/site';

interface ContactItem {
  key: 'email' | 'qq';
  icon: LucideIcon;
  value: string;
  /** 点了能直接打开的地址；没有时只显示文字 */
  href: string | null;
}

const CONTACTS: readonly ContactItem[] = [
  { key: 'email', icon: Mail, value: SITE.supportEmail, href: `mailto:${SITE.supportEmail}` },
  { key: 'qq', icon: MessageCircle, value: SITE.qqGroup, href: null },
];

/**
 * 联系我们：客服邮箱与 QQ 交流群，各带复制按钮。不做工单系统（用户 2026-10-04 定），
 * 邮箱是域名邮箱，由 Cloudflare 邮件转发到运营者的邮箱。
 */
export function SupportPage() {
  const t = useTranslations('consoleSupport');

  return (
    <ConsolePage id="support" title={t('meta.title')} width="narrow">
      <Panel id="support-contacts" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {CONTACTS.map(({ key, icon: Icon, value, href }) => (
            <li key={key} data-contact={key} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{t(`items.${key}.label`)}</p>
                {href === null ? (
                  <p className="truncate font-medium tabular-nums text-foreground">{value}</p>
                ) : (
                  <a
                    href={href}
                    className="block truncate font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {value}
                  </a>
                )}
              </div>
              <CopyButton
                name={`contact-${key}`}
                value={value}
                label={t(`items.${key}.copy`)}
                className="size-10 shrink-0 border border-border bg-card"
              />
            </li>
          ))}
        </ul>
      </Panel>
    </ConsolePage>
  );
}
