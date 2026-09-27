'use client';

/**
 * 成员额度编辑弹窗：固定总上限与周期额度两种模式。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 额度弹窗、
 * src/features/organization/validation.ts 的 createQuotaDraft / buildMemberQuotaPayload。
 *
 * 边界：
 * - 表单只持有 QuotaDraft 文本状态；金额、天数与生效日期的解析和载荷构造
 *   全部走 validation.ts，组件不自行拼请求体。
 * - 破坏性说明必须展示：立即生效或重设周期会开启新周期并重置当期已用；
 *   从周期额度转固定上限会退出周期但保留已消费金额，不能当作静默无害保存。
 * - 固定模式提供「不限额」复选：勾选后金额输入禁用，提交 spending_limit=null；
 *   金额 0 表示不能消费，不会因为留空或为 0 被当作不限。
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
import { saveMemberQuota } from './api';
import { organizationErrorText } from './errors';
import { QuotaPeriodicFields, quotaChangeNotices } from './member-shared';
import type { OrganizationMember, QuotaDraft } from './types';
import { buildMemberQuotaPayload, createQuotaDraft } from './validation';

export interface QuotaEditorProps {
  member: OrganizationMember;
  request: ApiRequester;
  onClose: () => void;
  /** 保存成功后由调用方刷新组织数据；self 表示改的是本人额度。 */
  onSaved: (member: OrganizationMember, self: boolean) => void | Promise<void>;
}

export function QuotaEditor({ member, request, onClose, onSaved }: QuotaEditorProps) {
  const [draft, setDraft] = useState<QuotaDraft>(() => createQuotaDraft(member));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchDraft(patch: Partial<QuotaDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setError(null);

    try {
      // 先按契约本地校验，避免把明显非法输入发到后端；载荷由 validation 生成。
      buildMemberQuotaPayload(draft);
    } catch (validationError) {
      setError(organizationErrorText(validationError, '额度设置不正确，请检查后重试'));
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMemberQuota(request, member.userId, draft);
      await onSaved(saved, member.isOwner);
      onClose();
    } catch (submitError) {
      setError(organizationErrorText(submitError, '保存额度失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }

  const notices = quotaChangeNotices(draft, member.quota !== null);
  const submitLabel = payloadKindLabel(draft);

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
            <DialogTitle>设置额度</DialogTitle>
            <DialogDescription>
              {member.displayName.trim() === ''
                ? `成员 #${member.userId}`
                : `${member.displayName}（${member.email}）`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="quota-mode">额度模式</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="额度模式">
                <Button
                  type="button"
                  variant={draft.mode === 'static' ? 'default' : 'outline'}
                  aria-pressed={draft.mode === 'static'}
                  disabled={saving}
                  onClick={() =>
                    patchDraft(
                      draft.mode === 'static'
                        ? { mode: 'static' }
                        : { mode: 'static', unlimited: false },
                    )
                  }
                >
                  固定总上限
                </Button>
                <Button
                  type="button"
                  variant={draft.mode === 'periodic' ? 'default' : 'outline'}
                  aria-pressed={draft.mode === 'periodic'}
                  disabled={saving}
                  onClick={() =>
                    patchDraft(
                      draft.mode === 'periodic'
                        ? { mode: 'periodic' }
                        : { mode: 'periodic', unlimited: false },
                    )
                  }
                >
                  周期额度
                </Button>
              </div>
            </div>

            {draft.mode === 'static' ? (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={draft.unlimited}
                    disabled={saving}
                    onChange={(event) => patchDraft({ unlimited: event.currentTarget.checked })}
                  />
                  不限额
                </label>
                <div className="space-y-2">
                  <Label htmlFor="quota-static-amount">总上限（USD）</Label>
                  <Input
                    id="quota-static-amount"
                    name="spending_limit"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft.amount}
                    disabled={saving || draft.unlimited}
                    onChange={(event) => patchDraft({ amount: event.currentTarget.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 表示该成员不能消费；勾选「不限额」后，该成员不受消费上限限制。
                  </p>
                </div>
              </div>
            ) : (
              <QuotaPeriodicFields
                draft={draft}
                disabled={saving}
                idPrefix="member-quota"
                onChange={patchDraft}
              />
            )}

            {notices.length > 0 ? (
              <Alert
                title="保存前请确认"
                description={notices.join(' ')}
                variant={
                  draft.mode === 'static' && member.quota !== null ? 'destructive' : 'default'
                }
              />
            ) : null}

            {error !== null ? <Alert variant="destructive" title={error} /> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" loading={saving}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 提交按钮文案：立即生效的周期额度会重置当期已用，按钮上再次点明。 */
function payloadKindLabel(draft: QuotaDraft): string {
  if (draft.mode === 'static') {
    return draft.unlimited ? '保存为不限额' : '保存固定上限';
  }
  return draft.starts === 'now' ? '保存并开启新周期' : '保存周期额度';
}
