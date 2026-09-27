'use client';

/**
 * 邀请码管理面板（组织所有者）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 邀请码章节、
 * src/features/organization/types.ts、.fleet/briefs/m45-organization-api.md。
 *
 * 边界：
 * - 数据只走 organization/api 的 fetchInvitations / createInvitation /
 *   disableInvitation；本组件不接触令牌，写操作不自行重试。
 * - 列表最多 100 条，状态里「已过期」由 invitationStatus 按到期时间派生，
 *   不伪造后端状态；只有未使用且未过期可作废，且必须确认。
 * - 邀请码不是 API 秘密（成员需要复制它注册），表格可明文展示；复制失败给出
 *   可见反馈，邀请码与链接都不写进日志。
 * - 注册链接只使用当前站点 origin，不写死任何域名。
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useAuth } from '../auth/auth-provider';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { formatOrganizationDate } from './format';
import { createInvitation, disableInvitation, fetchInvitations } from './api';
import { organizationErrorText } from './errors';
import {
  canDisableInvitation,
  copyPlainText,
  dateInputToRfc3339,
  invitationRegisterLink,
  invitationStatusMeta,
} from './invitation-status';
import type { OrganizationInvitation } from './types';
import { invitationStatus } from './validation';

/** 复制反馈只保留最近一次动作，避免整表状态膨胀。 */
interface CopyFeedback {
  id: number;
  ok: boolean;
  message: string;
}

function InvitationsPanelInner() {
  const { request, identityKey } = useAuth();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [expiryInput, setExpiryInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<OrganizationInvitation | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);

  const [disableTarget, setDisableTarget] = useState<OrganizationInvitation | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = usePortalQuery(
    ['organization', 'invitations'],
    (req: ApiRequester, signal: AbortSignal) => fetchInvitations(req, signal),
  );

  const rows = query.data ?? [];

  function invalidateOrganization() {
    void queryClient.invalidateQueries({ queryKey: ['portal', identityKey, 'organization'] });
  }

  function openCreate() {
    setExpiryInput('');
    setCreateError(null);
    setCreated(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (creating) {
      return;
    }
    setCreateOpen(false);
    setCreated(null);
    setCreateError(null);
    setExpiryInput('');
  }

  async function handleCopy(id: number, kind: 'code' | 'link', text: string) {
    setActionError(null);
    try {
      await copyPlainText(text);
      setCopyFeedback({
        id,
        ok: true,
        message: kind === 'code' ? '已复制邀请码' : '已复制邀请链接',
      });
    } catch (error) {
      setCopyFeedback({
        id,
        ok: false,
        message: organizationErrorText(error, '复制失败，请手动选择文本复制'),
      });
    }
  }

  function handleCopyLink(record: OrganizationInvitation) {
    const link = invitationRegisterLink(record.code);
    if (link === null) {
      setCopyFeedback({ id: record.id, ok: false, message: '当前环境没有可用的站点地址' });
      return;
    }
    void handleCopy(record.id, 'link', link);
  }

  async function handleCreate() {
    if (creating) {
      return;
    }
    setCreateError(null);

    let expiresAt: string | undefined;
    if (expiryInput.trim() !== '') {
      const parsed = dateInputToRfc3339(expiryInput);
      if (parsed === null) {
        setCreateError('到期日期不正确，请重新选择');
        return;
      }
      expiresAt = parsed;
    }

    setCreating(true);
    try {
      const invitation = await createInvitation(request, expiresAt);
      setCreated(invitation);
      invalidateOrganization();
      void query.refetch();
    } catch (error) {
      setCreateError(organizationErrorText(error, '创建邀请码失败，请稍后重试'));
    } finally {
      setCreating(false);
    }
  }

  async function handleDisable() {
    if (disabling || disableTarget === null) {
      return;
    }
    setDisabling(true);
    setActionError(null);
    try {
      await disableInvitation(request, disableTarget.id);
      setDisableTarget(null);
      invalidateOrganization();
      await query.refetch();
    } catch (error) {
      setActionError(organizationErrorText(error, '作废邀请码失败，请稍后重试'));
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <CardTitle>邀请码</CardTitle>
            <p className="text-sm text-muted-foreground">
              最多保留 100 条。成员使用邀请码注册后加入本组织。
            </p>
          </div>
          <Button type="button" onClick={openCreate}>
            新建邀请码
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionError !== null ? <Alert variant="destructive" title={actionError} /> : null}

          {query.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(query.error, '邀请码列表加载失败')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : null}

          {query.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <EmptyState
              title="暂时无法显示邀请码"
              description="请检查网络后重试。"
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="还没有邀请码"
              description="新建邀请码后，把邀请码或注册链接发给要加入的成员。"
              action={
                <Button type="button" onClick={openCreate}>
                  新建邀请码
                </Button>
              }
            />
          ) : (
            <Table className="min-w-table">
              <TableCaption>共 {rows.length} 条邀请码</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>邀请码</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>到期时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((record) => {
                  const displayStatus = invitationStatus(record);
                  const meta = invitationStatusMeta(displayStatus);
                  const feedback =
                    copyFeedback !== null && copyFeedback.id === record.id ? copyFeedback : null;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="min-w-0">
                        <span className="block break-all font-medium text-foreground">
                          {record.code}
                        </span>
                        {feedback !== null ? (
                          <span
                            role={feedback.ok ? 'status' : 'alert'}
                            className={
                              feedback.ok
                                ? 'text-xs text-muted-foreground'
                                : 'text-xs text-destructive'
                            }
                          >
                            {feedback.message}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatOrganizationDate(record.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {record.expiresAt === null
                          ? '永不过期'
                          : formatOrganizationDate(record.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void handleCopy(record.id, 'code', record.code);
                            }}
                          >
                            复制邀请码
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(record)}
                          >
                            复制邀请链接
                          </Button>
                          {canDisableInvitation(displayStatus) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                setActionError(null);
                                setDisableTarget(record);
                              }}
                            >
                              作废
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              closeCreate();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建邀请码</DialogTitle>
              <DialogDescription>
                到期日期留空表示永不过期。邀请码可随时作废，作废后不能再用于注册。
              </DialogDescription>
            </DialogHeader>

            {created !== null ? (
              <div className="space-y-4 py-5">
                <Alert
                  title="邀请码已创建"
                  description="把邀请码或注册链接发给要加入的成员，成员注册时填入即可。"
                />
                <div className="space-y-2">
                  <Label htmlFor="created-invitation-code">邀请码</Label>
                  <Input id="created-invitation-code" readOnly value={created.code} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void handleCopy(created.id, 'code', created.code);
                    }}
                  >
                    复制邀请码
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleCopyLink(created)}>
                    复制邀请链接
                  </Button>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">状态</dt>
                    <dd>{invitationStatusMeta(invitationStatus(created)).label}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">到期时间</dt>
                    <dd className="break-words">
                      {created.expiresAt === null
                        ? '永不过期'
                        : formatOrganizationDate(created.expiresAt)}
                    </dd>
                  </div>
                </dl>
                {copyFeedback !== null && copyFeedback.id === created.id ? (
                  <p
                    role={copyFeedback.ok ? 'status' : 'alert'}
                    className={
                      copyFeedback.ok ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'
                    }
                  >
                    {copyFeedback.message}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 py-5">
                <div className="space-y-2">
                  <Label htmlFor="invitation-expiry">到期日期</Label>
                  <Input
                    id="invitation-expiry"
                    name="expires_at"
                    type="date"
                    value={expiryInput}
                    disabled={creating}
                    onChange={(event) => {
                      setExpiryInput(event.currentTarget.value);
                      setCreateError(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">留空表示永不过期。</p>
                </div>
                {createError !== null ? <Alert variant="destructive" title={createError} /> : null}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={creating} onClick={closeCreate}>
                {created === null ? '取消' : '关闭'}
              </Button>
              {created === null ? (
                <Button type="button" loading={creating} onClick={() => void handleCreate()}>
                  创建邀请码
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {disableTarget !== null ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !disabling) {
              setDisableTarget(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>作废邀请码</DialogTitle>
              <DialogDescription>作废后该邀请码不能再用于注册，历史记录会保留。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">邀请码</p>
                <p className="break-all text-sm font-medium text-foreground">
                  {disableTarget.code}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">到期时间</p>
                <p className="text-sm text-foreground">
                  {disableTarget.expiresAt === null
                    ? '永不过期'
                    : formatOrganizationDate(disableTarget.expiresAt)}
                </p>
              </div>
              {actionError !== null ? <Alert variant="destructive" title={actionError} /> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={disabling}
                onClick={() => setDisableTarget(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={disabling}
                onClick={() => void handleDisable()}
              >
                确认作废
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** 非 owner 的兜底：即使父级误挂载也不发管理员请求。 */
function NotOwnerNotice() {
  return (
    <EmptyState
      title="只有组织所有者可以管理邀请码"
      description="如需邀请成员，请联系组织所有者。"
    />
  );
}

export function InvitationsPanel() {
  const { user, status } = useAuth();
  if (status === 'loading') {
    return <Skeleton className="h-40 w-full" />;
  }
  if (user === null || user.organization === null || !user.organization.isOwner) {
    return <NotOwnerNotice />;
  }
  return <InvitationsPanelInner />;
}
