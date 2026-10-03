'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Panel } from '@/components/console/panel';
import { StatCard } from '@/components/console/stat-card';
import { Input } from '@/components/ui/input';
import {
  formatInteger,
  formatPercent,
  formatUsd,
  INVITE_PROGRAM,
  type InviteStats,
} from '@/lib/console';

import { InviteShareMenu } from './invite-share-menu';

/** 规则每一行开头的小标题（「邀请人：」等）加粗并用主色 */
const emphasize = (chunks: ReactNode) => (
  <span className="font-medium text-foreground">{chunks}</span>
);

/**
 * 邀请链接面板：邀请链接与复制、分享入口，三条返利规则，以及累计返利、已到账、冻结中、邀请人数四个数字。
 * 规则里的比例和天数全部取自邀请计划数据，不写死在文案里。
 */
export function InviteLinkPanel({ stats }: { stats: InviteStats }) {
  const t = useTranslations('consoleInvite');

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
          value={INVITE_PROGRAM.link}
          // 点进输入框就全选，方便手动复制
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 font-mono text-xs sm:flex-1"
        />
        <div className="flex gap-2">
          <CopyButton
            name="invite-link"
            value={INVITE_PROGRAM.link}
            label={t('share.copyLink')}
            className="size-10 border border-border bg-card"
          />
          <InviteShareMenu />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <li>
          {t.rich('rules.inviter', {
            b: emphasize,
            window: INVITE_PROGRAM.windowDays,
            rate: formatPercent(INVITE_PROGRAM.inviterRate, 0),
          })}
        </li>
        <li>
          {t.rich('rules.invitee', {
            b: emphasize,
            bonus: formatPercent(INVITE_PROGRAM.inviteeBonusRate, 0),
          })}
        </li>
        <li>
          {t.rich('rules.payout', {
            b: emphasize,
            freeze: INVITE_PROGRAM.freezeDays,
          })}
        </li>
      </ul>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          id="rebate-total"
          size="sm"
          label={t('stats.total')}
          value={formatUsd(stats.totalRebateUsd)}
        />
        <StatCard
          id="rebate-released"
          size="sm"
          label={t('stats.released')}
          value={formatUsd(stats.releasedUsd)}
        />
        <StatCard
          id="rebate-frozen"
          size="sm"
          label={t('stats.frozen')}
          value={formatUsd(stats.frozenUsd)}
        />
        <StatCard
          id="invited"
          size="sm"
          label={t('stats.invited')}
          value={formatInteger(stats.invited)}
          sub={t('stats.effective', { count: stats.effective })}
        />
      </div>
    </Panel>
  );
}
