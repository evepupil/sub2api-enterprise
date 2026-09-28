'use client';

/**
 * 页面 15：组织用量。
 *
 * 契约来源：design/team-and-delivery.md 页面 15、organization-usage/types.ts、
 * features/organization-usage/api.ts 与 features/usage 的既有控件。
 *
 * 边界：
 * - 仅组织所有者可见：非 owner（含个人账号）直接渲染无权空态并给出概览入口，
 *   不渲染 OwnerView、不发任何组织统计请求；真实权限仍由后端判定。
 * - 概览与明细共用同一日期范围、粒度与成员筛选；日期或成员变更时页码回到第 1 页，
 *   旧范围数据不保留（queryKey 含全部筛选，失败不显示为 0 或空记录）。
 * - 成员筛选来自 organization/api.fetchAllMemberOptions（含 owner 与停用成员）；
 *   URL 带入的成员即使不在选项中也要保留为「成员 #id」，不能静默退回全组织。
 * - 组织成员分布由后端固定返回全组织口径，卡片标题与说明都保持「全组织成员分布」，
 *   不随成员筛选改名，也不把分布行数当作组织成员总数。
 * - 只消费 api/adapter 的已解析结果，不在展示层重复聚合；金额与数字复用 usage-format。
 */

import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '../../components/layout/page-header';
import { DateRangeControl } from '../../components/console/date-range-control';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { DEFAULT_TIME_ZONE, getPresetRange } from '../../lib/time/date-range';
import { useAuth } from '../auth/auth-provider';
import { usePortalQuery } from '../console/use-portal-query';
import { organizationErrorText } from '../organization/errors';
import { organizationMemberLabel } from '../organization/format';
import { fetchAllMemberOptions } from '../organization/api';
import { BreakdownCard } from '../usage/breakdown-card';
import type { DateRange, TrendGranularity } from '../usage/types';
import { fetchOrganizationOverview, fetchOrganizationRecords } from './api';
import { MemberDistributionCard } from './member-distribution';
import { OrganizationRecordsCard } from './organization-records';
import {
  OrganizationSummaryCards,
  OrganizationSummarySkeleton,
  OrganizationTrendCard,
} from './org-summary';

/** 组织用量明细固定每页 20 条。 */
const PAGE_SIZE = 20;
/** 「全组织」在 Radix Select 中的占位值（value 必须是字符串）。 */
const ALL_MEMBERS = '__all__';

function initialRange(): DateRange {
  return getPresetRange('last7', new Date(), DEFAULT_TIME_ZONE);
}

export interface OrganizationUsageViewProps {
  /** 从 URL 带入的 member_user_id；不存在即全组织统计。 */
  initialMemberId?: number;
}

/** 非所有者（或个人账号）看到的无权空态：不发组织请求，只给概览入口。 */
function OrganizationUsageForbidden() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="组织用量" />
      <Card className="min-w-0">
        <CardContent>
          <EmptyState
            title="当前账号没有组织用量权限"
            description="组织用量仅对组织所有者开放。个人用量请在概览页查看，如需组织统计请联系组织管理员。"
            action={
              <Button asChild variant="outline">
                <Link href="/console">返回概览</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface OwnerViewProps {
  initialMemberId?: number;
}

/** 所有者视图：只有这里才会发组织统计请求。 */
function OrganizationUsageOwnerView({ initialMemberId }: OwnerViewProps) {
  const [range, setRange] = React.useState<DateRange>(initialRange);
  const [granularity, setGranularity] = React.useState<TrendGranularity>('day');
  const [memberId, setMemberId] = React.useState<number | undefined>(initialMemberId);
  const [page, setPage] = React.useState(1);

  const overview = usePortalQuery(
    [
      'organization-usage',
      'overview',
      range.start,
      range.end,
      range.timeZone,
      granularity,
      memberId ?? null,
    ],
    (request, signal) =>
      fetchOrganizationOverview(request, { range, granularity, memberId }, signal),
  );

  const records = usePortalQuery(
    [
      'organization-usage',
      'records',
      range.start,
      range.end,
      range.timeZone,
      memberId ?? null,
      page,
    ],
    (request, signal) =>
      fetchOrganizationRecords(request, { range, memberId, page, pageSize: PAGE_SIZE }, signal),
  );

  const memberOptions = usePortalQuery(['organization', 'member-options'], (request, signal) =>
    fetchAllMemberOptions(request, signal),
  );

  const options = memberOptions.data ?? [];
  const optionForMember =
    memberId === undefined ? undefined : options.find((item) => item.userId === memberId);
  const memberIdInOptions = optionForMember !== undefined;

  /** 统计对象文案：全组织，或成员姓名（无法解析时用「成员 #id」兜底）。 */
  const scopeLabel =
    memberId === undefined
      ? '全组织'
      : optionForMember === undefined
        ? `成员 #${memberId}`
        : organizationMemberLabel(optionForMember);

  const applyRange = (next: DateRange): void => {
    setRange(next);
    setPage(1);
  };

  const applyMember = (next: number | undefined): void => {
    setMemberId(next);
    setPage(1);
  };

  const reset = (): void => {
    setRange(initialRange());
    setGranularity('day');
    setMemberId(undefined);
    setPage(1);
  };

  const overviewPending = overview.isPending;
  const overviewFailed = overview.isError;

  return (
    <div className="flex min-w-0 flex-col gap-6" data-org-usage="view">
      <PageHeader title="组织用量" />

      <div className="flex min-w-0 flex-col gap-3" data-org-usage="filters">
        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
          <DateRangeControl value={range} onChange={applyRange} presentation="compact" />
          <Select
            value={memberId === undefined ? ALL_MEMBERS : String(memberId)}
            onValueChange={(next) => applyMember(next === ALL_MEMBERS ? undefined : Number(next))}
          >
            <SelectTrigger aria-label="统计成员" className="w-auto shrink-0">
              <SelectValue placeholder="全组织" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MEMBERS}>全组织</SelectItem>
              {memberId !== undefined && !memberIdInOptions ? (
                <SelectItem value={String(memberId)}>{`成员 #${memberId}`}</SelectItem>
              ) : null}
              {options.map((item) => (
                <SelectItem key={item.userId} value={String(item.userId)}>
                  {organizationMemberLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={granularity}
            onValueChange={(value) => {
              if (value === 'day' || value === 'hour') {
                setGranularity(value);
                setPage(1);
              }
            }}
          >
            <SelectTrigger aria-label="趋势粒度" className="w-auto shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">按天</SelectItem>
              <SelectItem value="hour">按小时</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={reset}>
            重置
          </Button>
        </div>
        <p role="status" data-org-usage="scope" className="sr-only">
          当前统计对象：<span className="font-medium text-foreground">{scopeLabel}</span>
        </p>
        {memberOptions.isError ? (
          <Alert
            variant="destructive"
            title="成员列表加载失败"
            description={organizationErrorText(memberOptions.error, '请检查网络后重试')}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void memberOptions.refetch()}
              >
                重试
              </Button>
            }
          />
        ) : null}
      </div>

      {overviewFailed ? (
        <Alert
          variant="destructive"
          title="组织用量概览加载失败"
          description={organizationErrorText(overview.error, '请检查网络后重试')}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void overview.refetch()}
            >
              重试
            </Button>
          }
        />
      ) : overviewPending || overview.data === undefined ? (
        <OrganizationSummarySkeleton />
      ) : (
        <OrganizationSummaryCards overview={overview.data.overview} />
      )}

      {!overviewFailed && overview.data !== undefined ? (
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <MemberDistributionCard
            rows={overview.data.members}
            selectedMemberId={memberId}
            onSelectMember={applyMember}
          />
          <BreakdownCard title="模型分布" rows={overview.data.overview.models} />
          <div className="min-w-0 xl:col-span-2">
            <OrganizationTrendCard overview={overview.data.overview} />
          </div>
        </div>
      ) : null}

      <OrganizationRecordsCard
        items={records.data?.items ?? []}
        total={records.data?.total ?? 0}
        pages={records.data?.pages ?? 0}
        page={records.data?.page ?? page}
        timeZone={range.timeZone}
        isPending={records.isPending}
        isError={records.isError}
        errorText={organizationErrorText(records.error, '请检查网络后重试')}
        onRetry={() => void records.refetch()}
        onPageChange={setPage}
      />
    </div>
  );
}

/**
 * 组织用量页入口：先按已核实身份做 owner 守卫，再渲染所有者视图。
 * 路由在成员切换时用 key 重新挂载，这里也按 initialMemberId 重置内部状态。
 */
export function OrganizationUsageView({ initialMemberId }: OrganizationUsageViewProps) {
  const { user } = useAuth();
  const isOwner = user !== null && user.organization !== null && user.organization.isOwner;

  if (!isOwner) {
    return <OrganizationUsageForbidden />;
  }

  return (
    <React.Fragment key={initialMemberId ?? 'all'}>
      <OrganizationUsageOwnerView initialMemberId={initialMemberId} />
    </React.Fragment>
  );
}
