'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { OrgFailure } from '@/blocks/console/organization/organization-member-dialogs';
import { minuteOf, REQUEST_TONE } from '@/blocks/console/organization/organization-shared';
import { Button } from '@/components/console/button';
import { Skeleton } from '@/components/console/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/lib/console';
import { useLoadable } from '@/lib/console/live/loadable';
import {
  actOnQuotaRequest,
  fetchMyOrgQuota,
  fetchQuotaRequests,
} from '@/lib/console/live/org-client';
import type { OrgErrorReason, QuotaRequest } from '@/lib/console/live/org-types';

import { UsageOrgQuotaDialog } from './usage-org-quota-dialog';

/** 最近的申请只列这么几条（官网接口每页最少 10 条，取一页再截） */
const RECENT_COUNT = 3;
const RECENT_PAGE_SIZE = 10;

const CARD = 'rounded-2xl border border-border bg-card p-5 shadow-card';

/**
 * 用量页顶部的「组织配额」卡片，只给组织的普通成员（照 sub2api 原来仪表盘上的那张卡）：
 * 剩余额度（不限额时写不限额）与下次重置时间；管理员开了配额申请时可以申请额度，
 * 有一条在等处理时写「申请处理中」。下面列最近几条申请，待处理的可以撤回。
 * 后端说这个人不是普通成员（个人用户、组织管理员）时整张卡不显示。
 */
export function UsageOrgQuota({ reloadKey }: { reloadKey: number }) {
  const t = useTranslations('consoleOrg');
  const [version, setVersion] = useState(0);
  const [applying, setApplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);

  const key = `${reloadKey}|${version}`;
  const quota = useLoadable(`my-quota|${key}`, (signal) => fetchMyOrgQuota(signal));
  const recent = useLoadable(`my-requests|${key}`, (signal) =>
    fetchQuotaRequests({ page: 1, pageSize: RECENT_PAGE_SIZE, status: 'all' }, signal),
  );
  const refresh = () => setVersion((value) => value + 1);

  const withdraw = async (request: QuotaRequest) => {
    setFailure(null);
    setWithdrawing(request.id);
    const result = await actOnQuotaRequest(request.id, 'withdraw');
    setWithdrawing(null);
    if (!result.ok) setFailure(result.reason);
    refresh();
  };

  if (quota.data === null) {
    if (quota.error) {
      return (
        <section data-org-my-quota="error" className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            {t('loadError.title')}
            <Button variant="secondary" size="sm" onClick={refresh}>
              {t('loadError.retry')}
            </Button>
          </div>
        </section>
      );
    }
    return <Skeleton className="h-28 rounded-2xl" />;
  }
  const mine = quota.data.quota;
  if (mine === null) return null;

  const items = (recent.data?.items ?? []).slice(0, RECENT_COUNT);

  return (
    <section data-org-my-quota className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-subtle-foreground">{t('myQuota.title')}</div>
          <div
            data-org-my-remaining
            className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground"
          >
            {mine.remaining === null ? t('myQuota.unlimited') : formatUsd(mine.remaining)}
          </div>
          {mine.windowEnd ? (
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
              {t('myQuota.resetAt', { date: minuteOf(mine.windowEnd) })}
            </div>
          ) : null}
        </div>
        {mine.pendingExists ? (
          <Badge tone="warning" data-org-my-pending>
            {t('myQuota.pending')}
          </Badge>
        ) : mine.canRequest ? (
          <Button size="sm" onClick={() => setApplying(true)} data-org-apply>
            {t('myQuota.apply')}
          </Button>
        ) : null}
      </div>

      {items.length > 0 || (recent.error && recent.data === null) ? (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-xs font-medium text-subtle-foreground">{t('myQuota.recent')}</h3>
          {recent.error && recent.data === null ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('myQuota.recentFailed')}</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {items.map((request) => (
                <li
                  key={request.id}
                  data-org-my-request={request.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                >
                  <span className="font-medium tabular-nums text-foreground">
                    {formatUsd(request.amount)}
                  </span>
                  <Badge tone={REQUEST_TONE[request.status]}>
                    {t(`requests.status.${request.status}`)}
                  </Badge>
                  <span className="text-xs tabular-nums text-subtle-foreground">
                    {minuteOf(request.createdAt)}
                  </span>
                  {request.reviewNote || request.reason ? (
                    <span
                      className="min-w-0 flex-1 basis-40 truncate text-xs text-muted-foreground"
                      title={request.reviewNote || request.reason}
                    >
                      {request.reviewNote || request.reason}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  {request.status === 'pending' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={withdrawing === request.id}
                      onClick={() => void withdraw(request)}
                      data-org-withdraw={request.id}
                    >
                      {t('myQuota.withdraw')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {failure ? (
        <div className="mt-3">
          <OrgFailure reason={failure} />
        </div>
      ) : null}

      {applying ? (
        <UsageOrgQuotaDialog quota={mine} onClose={() => setApplying(false)} onDone={refresh} />
      ) : null}
    </section>
  );
}
