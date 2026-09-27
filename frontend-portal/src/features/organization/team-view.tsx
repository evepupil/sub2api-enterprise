'use client';

/**
 * 组织成员页面（/console/team）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14、DESIGN.md 第 4 章控件契约、
 * src/features/organization/types.ts 与冻结的 api.ts。
 *
 * 边界：
 * - 只有 `user.organization?.isOwner` 才挂载组织工作区；没有组织或普通成员
 *   只显示说明与返回控制台的入口，不发起任何管理员组织请求。
 * - 组织摘要来自 GET /organization，成员总数来自服务端返回的总数，
 *   不把当前分页条数当成员总数。
 * - 页签用 Button + aria-pressed 表达当前项；邀请码与配额申请分别复用
 *   InvitationsPanel / OwnerRequestsPanel（它们自行读取 Auth）。
 * - 所有组织查询 key 前缀为 ['organization', ...]，数据变更后统一失效
 *   ['portal', identityKey, 'organization']；影响本人的变更另行刷新身份。
 */

import Link from 'next/link';
import { useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/layout/page-header';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../auth/auth-provider';
import { usePortalQuery } from '../console/use-portal-query';
import { fetchMembers, fetchOrganization } from './api';
import { DefaultQuotaDialog } from './default-quota-dialog';
import { organizationErrorText } from './errors';
import { formatOrganizationDate } from './format';
import { InvitationsPanel } from './invitations-panel';
import { useOrganizationRefresh } from './member-shared';
import { MembersPanel } from './members-panel';
import { OwnerRequestsPanel } from './owner-requests-panel';

type TeamTab = 'members' | 'invitations' | 'requests';

const TABS: readonly { value: TeamTab; label: string }[] = [
  { value: 'members', label: '成员' },
  { value: 'invitations', label: '邀请码' },
  { value: 'requests', label: '配额申请' },
];

export function TeamView() {
  const { user, status } = useAuth();

  // 身份核实期间不判定权限，也不发任何管理员请求。
  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader title="组织成员" />
        <Card>
          <CardContent className="space-y-3" aria-busy="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 无组织或非所有者：只给说明与控制台入口，不发管理员请求。
  if (user === null || user.organization === null || !user.organization.isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader title="组织成员" />
        <EmptyState
          title="当前账号没有组织管理权限"
          description="组织成员与配额设置只对组织所有者开放。个人账户或普通成员可以返回控制台查看自己的密钥与用量。"
          action={
            <Button asChild variant="outline">
              <Link href="/console">返回控制台</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <TeamWorkspace />;
}

function TeamWorkspace() {
  const [tab, setTab] = useState<TeamTab>('members');
  const [defaultQuotaOpen, setDefaultQuotaOpen] = useState(false);
  const refreshOrganization = useOrganizationRefresh();

  // 组织摘要：名称、状态与创建时间；失败时给出可重试错误。
  const organizationQuery = usePortalQuery(['organization', 'summary'], (request, signal) =>
    fetchOrganization(request, signal),
  );

  // 成员总数：不带筛选，取第 1 页 1 条，只用 total，不当作分页数量。
  const countQuery = usePortalQuery(['organization', 'member-count'], (request, signal) =>
    fetchMembers(request, { page: 1, pageSize: 1 }, signal),
  );

  const organization = organizationQuery.data;
  const memberTotal = countQuery.data?.total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="组织成员"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setTab('invitations')}>
              邀请成员
            </Button>
            <Button type="button" onClick={() => setDefaultQuotaOpen(true)}>
              配额设置
            </Button>
          </>
        }
      />

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{organization?.name ?? '组织摘要'}</CardTitle>
          <CardDescription>当前身份：组织所有者</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {organizationQuery.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(organizationQuery.error, '组织信息加载失败')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void organizationQuery.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : organizationQuery.isPending ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-muted-foreground">组织名称</dt>
                <dd className="break-words font-medium text-foreground">
                  {organization?.name ?? '—'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">成员总数</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {countQuery.isError ? (
                    <span className="text-destructive">加载失败</span>
                  ) : memberTotal === undefined ? (
                    '加载中…'
                  ) : (
                    `${memberTotal} 位`
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">创建时间</dt>
                <dd className="whitespace-nowrap text-foreground">
                  {formatOrganizationDate(organization?.createdAt ?? null)}
                </dd>
              </div>
            </dl>
          )}

          {countQuery.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(countQuery.error, '成员总数加载失败')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void countQuery.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="组织成员页签">
            {TABS.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={tab === item.value ? 'default' : 'outline'}
                aria-pressed={tab === item.value}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {tab === 'members' ? (
            <MembersPanel />
          ) : tab === 'invitations' ? (
            <InvitationsPanel />
          ) : (
            <OwnerRequestsPanel />
          )}
        </CardContent>
      </Card>

      {defaultQuotaOpen ? (
        <DefaultQuotaDialog
          onClose={() => setDefaultQuotaOpen(false)}
          onSaved={async () => {
            await refreshOrganization();
          }}
        />
      ) : null}
    </div>
  );
}
