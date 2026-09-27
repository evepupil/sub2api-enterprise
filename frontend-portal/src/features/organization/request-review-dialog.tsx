'use client';

/**
 * 配额申请审批弹窗（同意/拒绝）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 配额申请章节、
 * src/features/organization/types.ts、.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 审批前必须显示申请成员与金额，审批备注最长 500 个 Unicode 码点，
 *   校验走 request-validation 的 reviewNote，组件不自行截断。
 * - 只有 pending 且能审批的记录才会打开本弹窗；未知状态不显示审批入口。
 * - 写操作不重试，用 ref 锁 + busy 状态严防重复提交；后端可能已把申请
 *   作废后返回错误，因此无论成功失败都由父级 finally 刷新申请与成员。
 */

import { useRef, useState } from 'react';

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
import { Label } from '../../components/ui/label';
import type { ApiRequester } from '../auth/types';
import { isObsoleteReviewTargetError, organizationErrorText } from './errors';
import { formatOrganizationDate, formatOrganizationMoney, organizationMemberLabel } from './format';
import { reviewQuotaRequest } from './request-api';
import { reviewNote } from './request-validation';
import type { QuotaRequestRecord } from './types';

export type ReviewAction = 'approve' | 'reject';

export interface RequestReviewDialogProps {
  record: QuotaRequestRecord;
  action: ReviewAction;
  request: ApiRequester;
  onClose: () => void;
  /** 成员资格已变化时，父级要保留安全错误并关闭过期的审批目标。 */
  onFailure: (message: string) => void;
  /** 审批结束后由父级刷新申请与成员，成功失败都要调用。 */
  onSettled: () => void | Promise<void>;
}

export function RequestReviewDialog({
  record,
  action,
  request,
  onClose,
  onFailure,
  onSettled,
}: RequestReviewDialogProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 防止同一提交被双击或回车连续触发；busy 只用于界面，锁用于逻辑。
  const locked = useRef(false);

  const approving = action === 'approve';
  const title = approving ? '同意配额申请' : '拒绝配额申请';

  async function handleSubmit() {
    if (locked.current) {
      return;
    }

    let cleanedNote: string;
    try {
      cleanedNote = reviewNote(note);
    } catch (validationError) {
      setError(organizationErrorText(validationError, '审批说明不正确，请检查后重试'));
      return;
    }

    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await reviewQuotaRequest(request, record.id, action, cleanedNote);
      onClose();
    } catch (submitError) {
      const safeMessage = organizationErrorText(submitError, '审批失败，请刷新后重试');
      setError(safeMessage);
      if (isObsoleteReviewTargetError(submitError)) {
        onFailure(safeMessage);
      }
    } finally {
      // 后端可能已改变申请状态，无论成败都让父级重新读取权威值。
      try {
        await onSettled();
      } finally {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {approving
              ? '同意后按申请金额为成员增加配额。'
              : '拒绝后本次申请结束，成员可以重新提交。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted-foreground">申请成员</dt>
              <dd className="break-words font-medium text-foreground">
                {organizationMemberLabel(record)}
              </dd>
              <dd className="break-all text-xs text-muted-foreground">{record.email}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">申请金额</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {formatOrganizationMoney(record.amount)}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-muted-foreground">申请理由</dt>
              <dd className="break-words text-foreground">
                {record.reason.trim() === '' ? '未填写' : record.reason}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">提交时间</dt>
              <dd className="text-foreground">{formatOrganizationDate(record.createdAt)}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Label htmlFor="review-note">审批说明（可选，最多 500 字）</Label>
            <textarea
              id="review-note"
              name="note"
              rows={3}
              value={note}
              disabled={busy}
              spellCheck={false}
              onChange={(event) => {
                setNote(event.currentTarget.value);
                setError(null);
              }}
              className="flex w-full min-w-0 rounded-control border border-input bg-card px-3 py-2 text-base text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
            <p className="text-xs text-muted-foreground">成员可以在自己的申请记录里看到说明。</p>
          </div>

          {error !== null ? <Alert variant="destructive" title={error} /> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            variant={approving ? 'default' : 'destructive'}
            loading={busy}
            onClick={() => void handleSubmit()}
          >
            {approving ? '确认同意' : '确认拒绝'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
