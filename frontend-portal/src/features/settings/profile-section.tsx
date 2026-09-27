'use client';

import { useState, type FormEvent } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { ApiRequester, PortalUser } from '../auth/types';
import { safeErrorMessage, updateUsername } from './api';

export interface ProfileSectionProps {
  user: PortalUser;
  request: ApiRequester;
  refreshUser: () => Promise<void>;
}

/** 个人资料：仅姓名可改，邮箱只读；保存期间阻止重复提交。 */
export function ProfileSection({ user, request, refreshUser }: ProfileSectionProps) {
  const [username, setUsername] = useState(user.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // 账号切换或后端核实后，用渲染期同步把外部值对齐到本地草稿（React 推荐模式）。
  const userKey = `${user.id}:${user.username}`;
  const [syncedKey, setSyncedKey] = useState(userKey);
  if (syncedKey !== userKey) {
    setSyncedKey(userKey);
    setUsername(user.username);
  }

  const trimmed = username.trim();
  const unchanged = trimmed === user.username;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (trimmed.length === 0) {
      setSaved(false);
      setError('请输入显示名称');
      return;
    }
    if (unchanged) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateUsername(request, trimmed);
      await refreshUser();
      setSaved(true);
    } catch (submitError) {
      setError(safeErrorMessage(submitError, '资料保存失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="settings-username">显示名称</Label>
            <Input
              id="settings-username"
              name="username"
              autoComplete="nickname"
              value={username}
              disabled={saving}
              aria-invalid={error !== null}
              onChange={(event) => {
                setUsername(event.currentTarget.value);
                setError(null);
                setSaved(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-email">邮箱</Label>
            <Input
              id="settings-email"
              name="email"
              type="email"
              value={user.email}
              readOnly
              aria-readonly="true"
              className="bg-muted"
            />
          </div>

          {error !== null ? <Alert variant="destructive" title={error} /> : null}
          {saved ? <Alert title="资料已更新" /> : null}

          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={unchanged || trimmed.length === 0}>
              保存资料
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
