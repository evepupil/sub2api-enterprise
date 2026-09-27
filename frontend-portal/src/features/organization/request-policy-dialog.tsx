'use client';

/**
 * 配额申请规则弹窗（组织所有者）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 配额申请章节、
 * src/features/organization/types.ts、.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 读取与保存只走 request-api 的 fetchRequestPolicy / saveRequestPolicy，
 *   载荷由 request-validation 的 buildPolicyPayload 生成，组件不自行拼请求体。
 * - 只有三种真实状态：关闭申请、需审批、自动发放；关闭时最小/最大金额按
 *   null 提交，不发送残留数字。金额为正数、最多 8 位小数，最大不得小于最小。
 * - 保存成功后由父级刷新，本弹窗不缓存权威值。
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
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { organizationErrorText } from './errors';
import { fetchRequestPolicy, saveRequestPolicy } from './request-api';
import { buildPolicyPayload } from './request-validation';
import type { PolicyDraft, QuotaRequestMode, QuotaRequestPolicy } from './types';

const MODE_OPTIONS: readonly { value: QuotaRequestMode; label: string; hint: string }[] = [
  { value: 'off', label: '关闭申请', hint: '成员不能提交配额申请。' },
  { value: 'approve', label: '需审批', hint: '成员提交后由所有者审批，通过后才发放。' },
  { value: 'auto', label: '自动发放', hint: '成员提交后立即按申请金额发放。' },
];

/** 数字金额转输入框文本；null 表示未设置，不回填成 0。 */
function amountToInput(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '' : String(value);
}

function toDraft(policy: QuotaRequestPolicy): PolicyDraft {
  return {
    mode: policy.mode,
    minAmount: amountToInput(policy.minAmount),
    maxAmount: amountToInput(policy.maxAmount),
  };
}

interface PolicyFormProps {
  policy: QuotaRequestPolicy;
  request: ApiRequester;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}

/** 表单在数据就绪后按权威值初始化，关闭即卸载，不依赖 effect 重置。 */
function PolicyForm({ policy, request, onClose, onSaved, onBusyChange }: PolicyFormProps) {
  const [draft, setDraft] = useState<PolicyDraft>(() => toDraft(policy));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const busyRef = useRef(false);

  function patchDraft(patch: Partial<PolicyDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
    setSavedMessage(null);
  }

  async function handleSave() {
    if (busyRef.current) {
      return;
    }
    setError(null);
    setSavedMessage(null);

    try {
      // 本地先校验金额，避免把明显非法输入发到后端；请求体由 saveRequestPolicy 生成。
      buildPolicyPayload(draft);
    } catch (validationError) {
      setError(organizationErrorText(validationError, '金额设置不正确，请检查后重试'));
      return;
    }

    busyRef.current = true;
    setSaving(true);
    onBusyChange(true);
    try {
      await saveRequestPolicy(request, draft);
      setSavedMessage('规则已保存');
      await onSaved();
    } catch (submitError) {
      setError(organizationErrorText(submitError, '保存失败，请稍后重试'));
    } finally {
      busyRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  const modeHint = MODE_OPTIONS.find((option) => option.value === draft.mode)?.hint ?? '';

  return (
    <>
      <div className="space-y-4 py-5">
        <div className="space-y-2">
          <Label htmlFor="request-policy-mode">申请方式</Label>
          <Select
            value={draft.mode}
            disabled={saving}
            onValueChange={(value) => patchDraft({ mode: value as QuotaRequestMode })}
          >
            <SelectTrigger id="request-policy-mode" aria-label="申请方式">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modeHint !== '' ? <p className="text-xs text-muted-foreground">{modeHint}</p> : null}
        </div>

        {draft.mode === 'off' ? (
          <p className="text-sm text-muted-foreground">
            关闭期间成员不能提交配额申请，已提交的申请仍可继续审批。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="request-policy-min">最小申请金额（USD）</Label>
              <Input
                id="request-policy-min"
                name="min_amount"
                inputMode="decimal"
                autoComplete="off"
                value={draft.minAmount}
                disabled={saving}
                onChange={(event) => patchDraft({ minAmount: event.currentTarget.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-policy-max">最大申请金额（USD）</Label>
              <Input
                id="request-policy-max"
                name="max_amount"
                inputMode="decimal"
                autoComplete="off"
                value={draft.maxAmount}
                disabled={saving}
                onChange={(event) => patchDraft({ maxAmount: event.currentTarget.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              金额最多 8 位小数；成员只能在这个区间内提交申请。
            </p>
          </div>
        )}

        {error !== null ? <Alert variant="destructive" title={error} /> : null}
        {savedMessage !== null ? (
          <p role="status" className="text-sm text-muted-foreground">
            {savedMessage}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          取消
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleSave()}>
          保存规则
        </Button>
      </DialogFooter>
    </>
  );
}

export interface RequestPolicyDialogProps {
  request: ApiRequester;
  onClose: () => void;
  /** 保存成功后由父级刷新申请列表。 */
  onSaved: () => void | Promise<void>;
}

export function RequestPolicyDialog({ request, onClose, onSaved }: RequestPolicyDialogProps) {
  const [saving, setSaving] = useState(false);
  const query = usePortalQuery(
    ['organization', 'quota-request-policy'],
    (req: ApiRequester, signal: AbortSignal) => fetchRequestPolicy(req, signal),
  );

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>配额申请规则</DialogTitle>
          <DialogDescription>设置成员能否提交配额申请，以及申请金额的范围。</DialogDescription>
        </DialogHeader>

        {query.isPending ? (
          <div className="space-y-3 py-5" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError ? (
          <div className="space-y-4 py-5">
            <Alert
              variant="destructive"
              title={organizationErrorText(query.error, '规则加载失败')}
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
          </div>
        ) : query.data === undefined || query.data === null ? (
          <div className="space-y-4 py-5">
            <Alert title="没有读取到配额申请规则" description="请关闭后重试。" />
          </div>
        ) : (
          <PolicyForm
            policy={query.data}
            request={request}
            onClose={onClose}
            onSaved={onSaved}
            onBusyChange={setSaving}
          />
        )}

        {query.isPending || query.isError ? (
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              关闭
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
