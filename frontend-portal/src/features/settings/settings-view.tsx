'use client';

import { useState } from 'react';

import { PageHeader } from '../../components/layout/page-header';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { useAuth } from '../auth/auth-provider';
import { PasswordSection } from './password-section';
import { ProfileSection } from './profile-section';
import { TotpSection } from './totp-section';

/**
 * 账号设置页面：个人资料、登录密码与双重验证，并提供明确的退出登录操作。
 *
 * 身份与请求来自 `useAuth()`（控制台守卫已确保已登录）；页面本身只负责组合
 * 三个区块，不处理路由、令牌或缓存。区块各自的查询失败只影响该区块。
 */
export function SettingsView() {
  const { user, request, refreshUser, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await logout();
      // 退出后由控制台守卫重定向到登录页，此处不直接改路由。
    } catch {
      // 本地会话已在 logout 内清理，服务端撤销失败不阻塞退出。
    } finally {
      setLoggingOut(false);
    }
  }

  if (user === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="账号设置" />
        <EmptyState title="登录状态已失效" description="请重新登录后再管理账号设置。" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="账号设置"
        actions={
          <Button variant="outline" onClick={() => void handleLogout()} loading={loggingOut}>
            退出登录
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProfileSection user={user} request={request} refreshUser={refreshUser} />
        <PasswordSection request={request} logout={logout} />
        <TotpSection request={request} />
      </div>
    </div>
  );
}
