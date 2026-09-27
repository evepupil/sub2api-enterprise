'use client';

/**
 * 普通成员配额申请弹窗：当前配额、提交表单与本人申请历史。
 *
 * 契约来源：design/team-and-delivery.md「成员申请弹窗」、
 * src/features/organization/types.ts、.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 当前配额只读 GET /usage/dashboard/stats 的 organization_quota
 *   （fetchMemberQuota），绝不请求所有者专属的申请规则接口。
 * - 请求模式 off / 剩余不限 / 已有 pending 时禁止新提交，并给出对应原因；
 *   历史列表仍可查看与撤回。
 * - 提交载荷统一由 buildQuotaRequestPayload 校验（金额边界、canRequest、
 *   pending），前端只按服务端返回的 status 判断「已发放 / 待审批」，
 *   绝不因 auto 模式在本地把余额当作已增加。
 * - 写操作提交期间禁止连点且不重试；结束（成功或失败）后刷新本人配额、
 *   申请历史与账号资金，服务端为唯一权威。
 * - 关闭弹窗即卸载，不在本地保留提交结果或旧输入。
 */

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../auth/auth-provider';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { organizationErrorText } from './errors';
import { formatOrganizationDate, formatOrganizationMoney } from './format';
import { MemberRequestList } from './member-request-list';
import { fetchMemberQuota, submitQuotaRequest } from './request-api';
import { buildQuotaRequestPayload } from './request-validation';
import type { MemberQuotaInfo, QuotaRequestRecord } from './types';

/** 理由上限：500 个 Unicode 码点（与校验层保持一致）。 */
const REASON_MAX_CODE_POINTS = 500;

/** 按 Unicode 码点计数，避免代理对被截断成半个字符。 */
function countCodePoints(value: string): number {
  return Array.from(value).length;
}

/** 配额摘要：剩余 null 明确表示不限，重置时间缺失显示为 —。 */
function QuotaSummary({ quota }: { quota: MemberQuotaInfo }) {
  return (
    <dl className="grid min-w-0 gap-3 rounded-card border border-border bg-muted/40 p-4 sm:grid-cols-2">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">当前剩余</dt>
        <dd className="font-semibold tabular-nums">
          {quota.remaining === null ? '不限' : formatOrganizationMoney(quota.remaining)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">下次重置</dt>
        <dd className="tabular-nums">
          {quota.windowEnd === null ? '—' : formatOrganizationDate(quota.windowEnd)}
        </dd>
      </div>
    </dl>
  );
}

/**
 * 提交禁用原因：返回 null 表示可以提交。
 * 原因必须来自服务端字段，不猜测、不把缺失当 false。
 */
function blockedReason(quota: MemberQuotaInfo): string | null {
  if (quota.requestMode === 'off') {
    return '管理员已关闭配额申请';
  }
  if (quota.remaining === null) {
    return '当前配额不限，无需申请';
  }
  if (quota.pendingExists) {
    return '已有待审批的申请，请等待处理';
  }
  if (!quota.canRequest) {
    return '当前不可提交配额申请';
  }
  return null;
}

export interface MemberRequestDialogProps {
  onClose: () => void;
}

export function MemberRequestDialog({ onClose }: MemberRequestDialogProps) {
  const { user, request, identityKey, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuotaRequestRecord | null>(null);

  const quota = usePortalQuery(
    ['organization', 'own-quota', 'member'],
    (request: ApiRequester, signal: AbortSignal) => fetchMemberQuota(request, signal),
  );

  const info = quota.data;
  const blocked = info === undefined ? null : blockedReason(info);
  const canSubmit = info !== undefined && blocked === null && !busy;
  const reasonLength = countCodePoints(reason);

  /** 提交结束统一刷新：本人配额、申请历史、账号资金（顶层 portal 前缀）。 */
  async function refreshAfterWrite() {
    await queryClient.invalidateQueries({ queryKey: ['portal', identityKey] });
    await quota.refetch();
    try {
      await refreshUser();
    } catch {
      // 身份刷新失败不改变已完成的申请结果，页面保留服务端权威值。
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (info === undefined || blocked !== null || busy) return;

    setError(null);
    let validated: { amount: number; reason: string };
    try {
      validated = buildQuotaRequestPayload({ amount, reason }, info);
    } catch (validationError) {
      setError(organizationErrorText(validationError, '申请金额或理由不符合要求'));
      return;
    }

    setBusy(true);
    try {
      // 提交只传原始文本，边界与格式由校验层/服务端确认。
      const record = await submitQuotaRequest(request, {
        amount: amount.trim(),
        reason: validated.reason,
      });
      // 只按服务端状态说明结果，auto 模式也不在本地增加余额。
      setResult(record);
      setAmount('');
      setReason('');
    } catch (submitError) {
      setError(organizationErrorText(submitError, '提交配额申请失败，请稍后重试'));
    } finally {
      await refreshAfterWrite();
      setBusy(false);
    }
  }

  const resultMessage =
    result === null
      ? null
      : result.status === 'granted'
        ? `申请已发放：${formatOrganizationMoney(result.grantedAmount ?? result.amount)}`
        : result.status === 'pending'
          ? '申请已提交，等待管理员审批'
          : '申请已提交，请在下方查看最新状态';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-dialog">
        <DialogHeader>
          <DialogTitle>配额申请</DialogTitle>
          <DialogDescription>
            申请通过后配额发放到本人账户；审批结果以服务端为准。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {quota.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : quota.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(quota.error, '当前配额暂时无法读取')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void quota.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : info !== undefined ? (
            <>
              <QuotaSummary quota={info} />

              {blocked !== null ? <Alert title={blocked} /> : null}

              {info.minAmount !== null || info.maxAmount !== null ? (
                <p className="text-xs text-muted-foreground">
                  申请范围：
                  {info.minAmount === null
                    ? '不限下限'
                    : formatOrganizationMoney(info.minAmount)}{' '}
                  至{' '}
                  {info.maxAmount === null ? '不限上限' : formatOrganizationMoney(info.maxAmount)}
                </p>
              ) : null}

              {resultMessage !== null ? <Alert title={resultMessage} /> : null}

              <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <div className="space-y-2">
                  <Label htmlFor="member-request-amount">申请金额（USD）</Label>
                  <Input
                    id="member-request-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    disabled={!canSubmit}
                    onChange={(event) => setAmount(event.currentTarget.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-request-reason">申请理由</Label>
                  <textarea
                    id="member-request-reason"
                    rows={3}
                    value={reason}
                    disabled={!canSubmit}
                    maxLength={REASON_MAX_CODE_POINTS}
                    onChange={(event) => setReason(event.currentTarget.value)}
                    placeholder="简要说明用途，最多 500 字"
                    className="flex w-full min-w-0 rounded-control border border-input bg-card px-3 py-2 text-base text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {reasonLength} / {REASON_MAX_CODE_POINTS}
                  </p>
                </div>

                {error !== null ? <Alert variant="destructive" title={error} /> : null}

                <DialogFooter>
                  <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                    关闭
                  </Button>
                  <Button type="submit" loading={busy} disabled={!canSubmit}>
                    提交申请
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}

          <MemberRequestList userId={user?.id ?? null} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
