'use client';

/**
 * 批量额度弹窗：均分总上限与批量设置周期额度。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 批量操作、
 * 冻结的 api.ts（splitMemberLimits / saveBatchQuota）与 validation.ts。
 *
 * 边界：
 * - 只处理调用方已选中的普通成员；本组件不自己勾选，默认没有勾选成员，
 *   成员为空时明确提示而不是提交空操作。
 * - 均分只把成员编号与总金额交给后端精确分配，前端不预先假算每人到账金额。
 * - 批量草稿强制为周期模式：批量静态上限没有定义好的后端载荷，
 *   因此不构造、也不冒充批量静态请求。
 * - 保存前明确展示受影响人数，以及会覆盖原设置、开启新周期并结束/重设当前周期。
 * - 保存中禁止重复提交；关闭弹窗由父组件卸载，在途响应不会复活弹窗。
 */

import { useState, type FormEvent } from 'react';

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
import type { ApiRequester } from '../auth/types';
import { saveBatchQuota, splitMemberLimits } from './api';
import { organizationErrorText } from './errors';
import { organizationMemberLabel } from './format';
import { canManageMember, QuotaPeriodicFields } from './member-shared';
import type { OrganizationMember, QuotaDraft } from './types';
import { buildMemberQuotaPayload, parseQuotaAmount } from './validation';

/** 批量只支持周期额度：静态上限的批量语义未定义。 */
const BATCH_DRAFT: QuotaDraft = {
  mode: 'periodic',
  unlimited: false,
  amount: '',
  periodDays: '',
  starts: 'now',
  startDate: '',
};

export interface BatchQuotaDialogProps {
  /** 当前选中的普通成员（调用方已排除所有者）。 */
  members: OrganizationMember[];
  request: ApiRequester;
  onClose: () => void;
  /** 任一写操作成功后由调用方刷新组织数据。 */
  onSaved: () => void | Promise<void>;
}

export function BatchQuotaDialog({ members, request, onClose, onSaved }: BatchQuotaDialogProps) {
  const [mode, setMode] = useState<'split' | 'periodic'>('split');
  const [splitTotal, setSplitTotal] = useState('');
  const [draft, setDraft] = useState<QuotaDraft>(BATCH_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleMembers = members.filter(canManageMember);
  const count = eligibleMembers.length;
  const userIds = eligibleMembers.map((member) => member.userId);

  function patchDraft(patch: Partial<QuotaDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || count === 0) {
      return;
    }
    setError(null);

    try {
      if (mode === 'split') {
        parseQuotaAmount(splitTotal, { positive: true });
      } else {
        buildMemberQuotaPayload({ ...draft, mode: 'periodic' });
      }
    } catch (validationError) {
      setError(organizationErrorText(validationError, '批量额度设置不正确，请检查后重试'));
      return;
    }

    setSaving(true);
    try {
      if (mode === 'split') {
        await splitMemberLimits(request, userIds, splitTotal);
      } else {
        await saveBatchQuota(request, userIds, { ...draft, mode: 'periodic' });
      }
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(organizationErrorText(submitError, '批量操作失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>批量设置额度</DialogTitle>
            <DialogDescription>
              已选 {count} 位成员。操作会覆盖这些成员原有的额度设置，并结束或重设当前周期。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="batch-mode">操作方式</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="批量操作方式">
                <Button
                  type="button"
                  variant={mode === 'split' ? 'default' : 'outline'}
                  aria-pressed={mode === 'split'}
                  disabled={saving}
                  onClick={() => {
                    setMode('split');
                    setError(null);
                  }}
                >
                  均分总上限
                </Button>
                <Button
                  type="button"
                  variant={mode === 'periodic' ? 'default' : 'outline'}
                  aria-pressed={mode === 'periodic'}
                  disabled={saving}
                  onClick={() => {
                    setMode('periodic');
                    setError(null);
                  }}
                >
                  批量设置周期额度
                </Button>
              </div>
            </div>

            {mode === 'split' ? (
              <div className="space-y-2">
                <Label htmlFor="batch-split-total">总上限（USD）</Label>
                <Input
                  id="batch-split-total"
                  name="total_amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={splitTotal}
                  disabled={saving}
                  onChange={(event) => {
                    setSplitTotal(event.currentTarget.value);
                    setError(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  系统会根据总金额和成员数量精确分配额度。
                </p>
              </div>
            ) : (
              <QuotaPeriodicFields
                draft={draft}
                disabled={saving}
                idPrefix="batch-quota"
                onChange={patchDraft}
              />
            )}

            <div className="min-w-0 rounded-card border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">受影响成员（{count}）</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {count === 0
                  ? '尚未选择成员，请先在成员列表勾选后再打开批量操作。'
                  : eligibleMembers.map((member) => organizationMemberLabel(member)).join('、')}
              </p>
            </div>

            <Alert
              title="保存前请确认"
              description={
                mode === 'split'
                  ? '均分会覆盖这些成员的原有额度上限，并结束其当前周期额度；已消费金额保留。'
                  : draft.starts === 'now'
                    ? '保存后会立即为这些成员开启新周期，当期已用额度将被重置为 0。'
                    : '保存后会在指定日期为这些成员开启新周期；到期前当前周期继续生效。'
              }
            />

            {error !== null ? <Alert variant="destructive" title={error} /> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" loading={saving} disabled={count === 0}>
              {mode === 'split' ? `均分给 ${count} 位成员` : `为 ${count} 位成员保存周期额度`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
