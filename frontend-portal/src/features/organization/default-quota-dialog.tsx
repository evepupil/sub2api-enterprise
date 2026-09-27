'use client';

/**
 * 默认周期额度设置弹窗（页头「配额设置」）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 默认周期额度设置、
 * 冻结的 api.ts（fetchDefaultQuota / saveDefaultQuota）与 validation.ts。
 *
 * 边界：
 * - 打开时真实读取 /organization/default-quota；读取失败给出可重试错误，
 *   不用 0 或默认值伪造成功状态。
 * - 启用、金额、天数与两个同步复选：syncUnconfigured / syncConfigured
 *   默认均为 false，不做破坏性默认勾选；勾选时明确提示会开启新周期并重置已用。
 * - 金额与天数的校验走 validation.ts 的 buildDefaultQuotaPayload，
 *   组件不自行解析；保存成功后展示后端返回的同步人数并刷新组织数据。
 * - 保存中禁止重复提交；关闭弹窗由父组件卸载，迟到的响应不会复活弹窗。
 * - 查询未完成前不渲染表单，表单用已加载值做初始状态，不在渲染期间回写状态。
 */

import { useRef, useState, type FormEvent } from 'react';

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
import { usePortalQuery } from '../console/use-portal-query';
import { fetchDefaultQuota, saveDefaultQuota } from './api';
import { organizationErrorText } from './errors';
import type { DefaultQuota, DefaultQuotaDraft, DefaultQuotaResult } from './types';
import { buildDefaultQuotaPayload } from './validation';

export interface DefaultQuotaDialogProps {
  onClose: () => void;
  /** 保存成功后由调用方刷新组织数据。 */
  onSaved: () => void | Promise<void>;
}

export function DefaultQuotaDialog({ onClose, onSaved }: DefaultQuotaDialogProps) {
  const [saving, setSaving] = useState(false);
  const quotaQuery = usePortalQuery(['organization', 'default-quota'], (request, signal) =>
    fetchDefaultQuota(request, signal),
  );

  const data = quotaQuery.data;
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
        <DialogHeader>
          <DialogTitle>默认周期额度</DialogTitle>
          <DialogDescription>
            只对尚未单独配置额度的新成员生效；已有成员需显式勾选同步才会被改写。
          </DialogDescription>
        </DialogHeader>

        <div className="py-5">
          {quotaQuery.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(quotaQuery.error, '默认额度加载失败，请重试')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void quotaQuery.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : data === undefined ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <DefaultQuotaForm
              quota={data}
              onClose={onClose}
              onSaved={onSaved}
              onBusyChange={setSaving}
            />
          )}
        </div>

        {quotaQuery.isError || data === undefined ? (
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

interface DefaultQuotaFormProps {
  quota: DefaultQuota;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}

/** 表单独立组件：用服务端已加载值做初始状态，避免渲染期间回写。 */
function DefaultQuotaForm({ quota, onClose, onSaved, onBusyChange }: DefaultQuotaFormProps) {
  const { request } = useAuth();
  const [draft, setDraft] = useState<DefaultQuotaDraft>(() => ({
    enabled: quota.enabled,
    amount: quota.amount === null ? '' : String(quota.amount),
    periodDays: quota.periodDays === null ? '' : String(quota.periodDays),
    syncUnconfigured: false,
    syncConfigured: false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DefaultQuotaResult | null>(null);
  const busyRef = useRef(false);

  function patchDraft(patch: Partial<DefaultQuotaDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || result !== null) {
      return;
    }
    setError(null);

    try {
      buildDefaultQuotaPayload(draft);
    } catch (validationError) {
      setError(organizationErrorText(validationError, '默认额度设置不正确，请检查后重试'));
      return;
    }

    busyRef.current = true;
    setSaving(true);
    onBusyChange(true);
    try {
      const saved = await saveDefaultQuota(request, draft);
      setResult(saved);
    } catch (submitError) {
      setError(organizationErrorText(submitError, '保存默认额度失败，请稍后重试'));
    } finally {
      try {
        // 无论成功或失败都刷新权威状态：底座可能已经部分生效。
        await onSaved();
      } finally {
        busyRef.current = false;
        setSaving(false);
        onBusyChange(false);
      }
    }
  }

  const syncScope = !draft.enabled
    ? null
    : draft.syncUnconfigured && draft.syncConfigured
      ? '全部普通成员'
      : draft.syncUnconfigured
        ? '未配置成员'
        : draft.syncConfigured
          ? '已配置成员'
          : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={draft.enabled}
          disabled={saving || result !== null}
          onChange={(event) => patchDraft({ enabled: event.currentTarget.checked })}
        />
        启用默认周期额度
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="default-amount">周期金额（USD）</Label>
          <Input
            id="default-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={draft.amount}
            disabled={saving || !draft.enabled || result !== null}
            onChange={(event) => patchDraft({ amount: event.currentTarget.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default-days">周期天数</Label>
          <Input
            id="default-days"
            name="period_days"
            inputMode="numeric"
            autoComplete="off"
            value={draft.periodDays}
            disabled={saving || !draft.enabled || result !== null}
            onChange={(event) => patchDraft({ periodDays: event.currentTarget.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        周期天数 1 到 3650 天；金额最多 8 位小数，0 表示不能消费。
      </p>

      <fieldset className="space-y-3" disabled={saving || !draft.enabled || result !== null}>
        <legend className="text-sm font-medium text-foreground">同步已有成员</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={draft.syncUnconfigured}
            onChange={(event) => patchDraft({ syncUnconfigured: event.currentTarget.checked })}
          />
          <span>同步未配置额度的成员</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={draft.syncConfigured}
            onChange={(event) => patchDraft({ syncConfigured: event.currentTarget.checked })}
          />
          <span>同步已配置额度的成员（会覆盖其原有设置）</span>
        </label>
      </fieldset>

      {syncScope !== null && result === null ? (
        <Alert
          variant="destructive"
          title="同步会重置当期已用"
          description="同步意味着为被同步成员开启新周期并重置当期使用；请确认影响范围后再保存。"
        />
      ) : null}

      {result !== null ? (
        <Alert
          title="默认额度已保存"
          description={`已同步 ${result.syncedUsers} 位成员；新加入的成员按上述设置生效。`}
        />
      ) : null}

      {error !== null ? <Alert variant="destructive" title={error} /> : null}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          {result === null ? '取消' : '关闭'}
        </Button>
        {result === null ? (
          <Button type="submit" loading={saving}>
            {syncScope !== null ? `保存并同步${syncScope}` : '保存默认额度'}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  );
}
