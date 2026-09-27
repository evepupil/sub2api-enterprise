'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { ApiRequester } from '../auth/types';
import { changePassword, safeErrorMessage } from './api';

/** 新密码最小长度，与后端规则保持一致。 */
const MIN_PASSWORD_LENGTH = 6;

export interface PasswordSectionProps {
  request: ApiRequester;
  logout: () => Promise<void>;
}

/**
 * 修改密码：成功后先退出当前会话，再回到登录页重新登录。
 * 三个字段只保存在本次表单 state，成功或卸载后不再保留；失败不自动重试。
 */
export function PasswordSection({ request, logout }: PasswordSectionProps) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetFields() {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (oldPassword.length === 0) {
      setError('请输入当前密码');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`新密码至少 ${MIN_PASSWORD_LENGTH} 位`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changePassword(request, { oldPassword, newPassword });
    } catch (submitError) {
      setError(safeErrorMessage(submitError, '密码修改失败，请稍后重试'));
      setSaving(false);
      return;
    }

    // 密码已修改：先清空内存中的输入，再退出并回到登录页。
    resetFields();
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录密码</CardTitle>
        <CardDescription>修改后需要重新登录，请使用新密码。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="settings-old-password">当前密码</Label>
            <Input
              id="settings-old-password"
              name="old-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              disabled={saving}
              onChange={(event) => {
                setOldPassword(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-new-password">新密码</Label>
            <Input
              id="settings-new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              disabled={saving}
              aria-describedby="settings-new-password-hint"
              onChange={(event) => {
                setNewPassword(event.currentTarget.value);
                setError(null);
              }}
            />
            <p id="settings-new-password-hint" className="text-xs text-muted-foreground">
              至少 {MIN_PASSWORD_LENGTH} 位。
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-confirm-password">确认新密码</Label>
            <Input
              id="settings-confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={saving}
              onChange={(event) => {
                setConfirmPassword(event.currentTarget.value);
                setError(null);
              }}
            />
          </div>

          {error !== null ? <Alert variant="destructive" title={error} /> : null}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              修改密码
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
