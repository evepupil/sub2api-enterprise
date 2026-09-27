'use client';

/**
 * 成员显示名称编辑弹窗。
 *
 * 契约来源：design/team-and-delivery.md 页面 14、DESIGN.md 第 4 章弹窗契约。
 *
 * 边界：
 * - 只提交显示名称；名称的 trim 与 1..50 Unicode 码点校验走 validation.ts 的
 *   validateDisplayName，不在组件里另写一套长度规则。
 * - 写操作由调用方注入 request（api.ts 的 updateMemberName），组件不接触令牌、
 *   不自行重试；成功后由调用方刷新组织查询与（本人时）身份。
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
import { updateMemberName } from './api';
import { organizationErrorText } from './errors';
import type { OrganizationMember } from './types';
import { validateDisplayName } from './validation';

export interface MemberDialogProps {
  member: OrganizationMember;
  request: ApiRequester;
  /** 保存成功且已完成刷新后关闭弹窗。 */
  onClose: () => void;
  /** 保存成功后由调用方刷新组织数据；self 表示改的是本人名称。 */
  onSaved: (member: OrganizationMember, self: boolean) => void | Promise<void>;
}

export function MemberDialog({ member, request, onClose, onSaved }: MemberDialogProps) {
  const [value, setValue] = useState(() => member.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setError(null);

    let name: string;
    try {
      name = validateDisplayName(value);
    } catch (validationError) {
      setError(organizationErrorText(validationError, '显示名称不正确，请检查后重试'));
      return;
    }

    setSaving(true);
    try {
      const saved = await updateMemberName(request, member.userId, name);
      // 只有编辑所有者本人时才需要同步当前登录身份。
      await onSaved(saved, member.isOwner);
      onClose();
    } catch (submitError) {
      setError(organizationErrorText(submitError, '保存失败，请稍后重试'));
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
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>编辑显示名称</DialogTitle>
            <DialogDescription>用于在组织内识别这位成员。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-5">
            <Label htmlFor="member-display-name">显示名称</Label>
            <Input
              id="member-display-name"
              name="display_name"
              autoComplete="off"
              value={value}
              disabled={saving}
              aria-invalid={error !== null}
              onChange={(event) => {
                setValue(event.currentTarget.value);
                setError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">1 到 50 个字符，首尾空格会被去掉。</p>
            {error !== null ? <Alert variant="destructive" title={error} /> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" loading={saving}>
              保存修改
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
