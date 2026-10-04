'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Panel } from '@/components/console/panel';
import { StatCard } from '@/components/console/stat-card';
import { Input } from '@/components/ui/input';
import type { AppLocale } from '@/i18n/routing';
import { formatInteger, formatPercent, formatUsd } from '@/lib/console';
import type { AffiliateDetail } from '@/lib/console/live/invite-types';
import { freezePeriod, inviteLink, rebatedInviteeCount } from '@/lib/console/live/invite-view';

import { InviteShareMenu } from './invite-share-menu';

/** 规则每一行开头的小标题（「邀请：」等）加粗并用主色 */
const emphasize = (chunks: ReactNode) => (
  <span className="font-medium text-foreground">{chunks}</span>
);

/**
 * 邀请链接面板：邀请链接与复制、分享入口，返利规则（比例、有效期、单人上限、冻结期都按后台设置写），
 * 以及累计返利、待到账、邀请人数三个数字。返利由后端自动转进余额，页面上没有要手动操作的。
 * 只在浏览器里渲染（数据挂载后才取到），链接用当前站点的地址拼。
 */
export function InviteLinkPanel({ detail }: { detail: AffiliateDetail }) {
  const t = useTranslations('consoleInvite');
  const locale = useLocale() as AppLocale;
  const { rules } = detail;

  // 这块只在数据取到后（浏览器里）渲染；保险起见没有 window 时用相对地址
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const link = inviteLink(origin, locale, detail.code);
  const rebated = rebatedInviteeCount(detail);

  return (
    <Panel id="invite-link">
      <label htmlFor="invite-link-input" className="block text-sm font-medium text-foreground">
        {t('link.label')}
      </label>
      {/* 手机上链接独占一行（完整看到地址），按钮换到下一行；sm 起三者排成一行 */}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="invite-link-input"
          data-invite-link
          readOnly
          value={link}
          // 点进输入框就全选，方便手动复制
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 font-mono text-xs sm:flex-1"
        />
        <div className="flex gap-2">
          <CopyButton
            name="invite-link"
            value={link}
            label={t('share.copyLink')}
            className="size-10 border border-border bg-card"
          />
          <InviteShareMenu code={detail.code} link={link} />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <li>{t.rich('rules.invite', { b: emphasize })}</li>
        <li>
          {t.rich('rules.rebate', {
            b: emphasize,
            rate: formatPercent(rules.ratePercent / 100, 2),
          })}
        </li>
        {/* 有效期、单人上限后台没设时不写 */}
        {rules.durationDays > 0 ? (
          <li>{t('rules.duration', { days: rules.durationDays })}</li>
        ) : null}
        {rules.perInviteeCapUsd > 0 ? (
          <li>{t('rules.cap', { amount: formatUsd(rules.perInviteeCapUsd) })}</li>
        ) : null}
        <li>
          {rules.freezeHours > 0
            ? t.rich('rules.payoutFrozen', { b: emphasize, ...freezePeriod(rules.freezeHours) })
            : t.rich('rules.payout', { b: emphasize })}
        </li>
      </ul>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <StatCard
          id="rebate-total"
          size="sm"
          label={t('stats.total')}
          value={formatUsd(detail.totalUsd)}
        />
        <StatCard
          id="rebate-pending"
          size="sm"
          label={t('stats.pending')}
          value={formatUsd(detail.pendingUsd)}
        />
        <StatCard
          id="invited"
          size="sm"
          label={t('stats.invited')}
          value={formatInteger(detail.invited)}
          sub={detail.invited > 0 ? t('stats.rebated', { count: rebated }) : undefined}
        />
      </div>
    </Panel>
  );
}
