'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/console/button';
import { CopyButton } from '@/components/console/copy-button';
import { Panel } from '@/components/console/panel';
import { StatCard } from '@/components/console/stat-card';
import { Input } from '@/components/ui/input';
import type { AppLocale } from '@/i18n/routing';
import { formatInteger, formatPercent, formatUsd } from '@/lib/console';
import { transferAffiliate } from '@/lib/console/live/invite-client';
import type { AffiliateDetail, TransferError } from '@/lib/console/live/invite-types';
import { inviteLink, rebatedInviteeCount } from '@/lib/console/live/invite-view';
import { loginRedirectFor } from '@/lib/session/guard';

import { InviteShareMenu } from './invite-share-menu';

/** 规则每一行开头的小标题（「邀请：」等）加粗并用主色 */
const emphasize = (chunks: ReactNode) => (
  <span className="font-medium text-foreground">{chunks}</span>
);

/**
 * 邀请链接面板：邀请链接与复制、分享入口，返利规则（比例取后端的真实比例），
 * 以及累计返利、可转入余额（带「转入余额」）、冻结中、邀请人数四个数字。
 * 只在浏览器里渲染（数据挂载后才取到），链接用当前站点的地址拼。
 */
export function InviteLinkPanel({
  detail,
  refreshing,
  onTransferred,
}: {
  detail: AffiliateDetail;
  /** 页面正在重新取数据（转入后到新数字回来之前，按钮不能再点） */
  refreshing: boolean;
  /** 转入余额成功后让页面重新取数据 */
  onTransferred: () => void;
}) {
  const t = useTranslations('consoleInvite');
  const locale = useLocale() as AppLocale;
  const [transferring, setTransferring] = useState(false);
  const [result, setResult] = useState<
    { kind: 'done'; amountUsd: number } | { kind: 'error'; reason: TransferError } | null
  >(null);

  // 这块只在数据取到后（浏览器里）渲染；保险起见没有 window 时用相对地址
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const link = inviteLink(origin, locale, detail.code);
  const rebated = rebatedInviteeCount(detail);

  const transfer = async () => {
    if (transferring || refreshing || detail.availableUsd <= 0) return;
    setTransferring(true);
    setResult(null);
    const outcome = await transferAffiliate();
    setTransferring(false);
    if (outcome.kind === 'signed_out') {
      window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
      return;
    }
    if (outcome.kind === 'error') {
      setResult({ kind: 'error', reason: outcome.reason });
      return;
    }
    setResult({ kind: 'done', amountUsd: outcome.transfer.transferredUsd });
    onTransferred();
  };

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
            rate: formatPercent(detail.ratePercent / 100, 2),
          })}
        </li>
        <li>{t.rich('rules.payout', { b: emphasize })}</li>
        {/* 有冻结中的返利时才提冻结期（后台可以不设冻结期） */}
        {detail.frozenUsd > 0 ? <li>{t('rules.frozen')}</li> : null}
      </ul>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          id="rebate-total"
          size="sm"
          label={t('stats.total')}
          value={formatUsd(detail.totalUsd)}
        />
        <StatCard
          id="rebate-available"
          size="sm"
          label={t('stats.available')}
          value={formatUsd(detail.availableUsd)}
          aside={
            <Button
              variant="link"
              size="sm"
              data-invite-transfer
              className="h-auto text-xs"
              disabled={detail.availableUsd <= 0 || transferring || refreshing}
              onClick={() => void transfer()}
            >
              {transferring ? t('transfer.working') : t('transfer.action')}
            </Button>
          }
        />
        <StatCard
          id="rebate-frozen"
          size="sm"
          label={t('stats.frozen')}
          value={formatUsd(detail.frozenUsd)}
        />
        <StatCard
          id="invited"
          size="sm"
          label={t('stats.invited')}
          value={formatInteger(detail.invited)}
          sub={detail.invited > 0 ? t('stats.rebated', { count: rebated }) : undefined}
        />
      </div>

      {result?.kind === 'done' ? (
        <p role="status" data-invite-transfer-result className="mt-3 text-sm text-success">
          {t('transfer.done', { amount: formatUsd(result.amountUsd) })}
        </p>
      ) : result?.kind === 'error' ? (
        <p role="alert" data-invite-transfer-error className="mt-3 text-sm text-danger">
          {t(`transfer.errors.${result.reason}`)}
        </p>
      ) : null}
    </Panel>
  );
}
