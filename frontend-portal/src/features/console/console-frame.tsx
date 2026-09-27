'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { ConsoleShell } from '../../components/layout/console-shell';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import type { Audience } from '../../lib/navigation';
import { useAuth } from '../auth/auth-provider';
import type { PortalUser } from '../auth/types';

/**
 * 客户控制台身份守卫与外壳接线。
 *
 * 契约来源：design/customer-console.md 第 2/4 节、design/console-pages.md 共用章节。
 *
 * 边界：
 * - 只读取 `useAuth()` 已核实的身份，不接触令牌、不自行请求后端。
 * - 未登录跳 `/login?next=<本站安全路径>`，next 只含当前站内 path + query。
 * - 账号切换由 children 外层的 identityKey 重新挂载，旧页表单与临时 secret 立即销毁。
 * - 导航只影响展示；真实权限仍由后端核对，这里不代替鉴权。
 */

export interface ConsoleFrameProps {
  children?: React.ReactNode;
}

/** 组织为空是个人账户；有组织且是所有者是 owner，否则是普通成员。 */
function audienceFor(user: PortalUser): Audience {
  if (user.organization === null) {
    return 'personal';
  }
  return user.organization.isOwner ? 'owner' : 'member';
}

/** 身份标识：优先组织名，其次用户名，最后邮箱；空字符串按缺省处理。 */
function accountLabelFor(user: PortalUser): string {
  const organizationName = user.organization?.name.trim();
  if (organizationName !== undefined && organizationName !== '') {
    return organizationName;
  }
  const username = user.username.trim();
  if (username !== '') {
    return username;
  }
  return user.email;
}

/** 身份核实期间的占位：不给私有页渲染任何内容，避免用旧账号数据闪屏。 */
function VerificationPlaceholder() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-dialog space-y-4 rounded-card border border-border bg-card p-6">
        <p role="status" className="text-sm text-muted-foreground">
          正在验证登录状态…
        </p>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export interface VerificationErrorProps {
  onRetry: () => void;
  onLogout: () => void;
  retrying: boolean;
  loggingOut: boolean;
}

/** 身份核实失败：可重试核实，也可退出后重新登录；不展示原始响应内容。 */
function VerificationError({ onRetry, onLogout, retrying, loggingOut }: VerificationErrorProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-dialog">
        <Alert
          title="登录状态验证失败"
          description="无法确认当前账号状态。可以重试核实；若持续失败，请退出后重新登录。"
          variant="destructive"
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onRetry} loading={retrying}>
                重试
              </Button>
              <Button type="button" variant="outline" onClick={onLogout} loading={loggingOut}>
                退出登录
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}

/**
 * 控制台身份守卫与外壳：加载中占位、核实失败可重试/退出、匿名跳登录、
 * 已登录按组织身份渲染 ConsoleShell，并把退出登录作为账户操作。
 *
 * 读取路径与查询参数的实现放在 Suspense 边界内，这样静态路由预渲染时
 * 仍能输出验证占位，不会因客户端 URL 钩子阻塞构建。
 */
export function ConsoleFrame({ children }: ConsoleFrameProps) {
  return (
    <React.Suspense fallback={<VerificationPlaceholder />}>
      <ConsoleGuard>{children}</ConsoleGuard>
    </React.Suspense>
  );
}

function ConsoleGuard({ children }: ConsoleFrameProps) {
  const { status, user, identityKey, refreshUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [retrying, setRetrying] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const query = searchParams.toString();
  const nextPath = query === '' ? pathname : `${pathname}?${query}`;

  React.useEffect(() => {
    if (status !== 'anonymous') {
      return;
    }
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [status, router, nextPath]);

  const handleNavigate = React.useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  const handleRetry = React.useCallback(() => {
    setRetrying(true);
    void refreshUser()
      .catch(() => {
        // 失败时保持当前错误状态，由用户再次选择重试或退出。
      })
      .finally(() => {
        setRetrying(false);
      });
  }, [refreshUser]);

  const handleLogout = React.useCallback(() => {
    setLoggingOut(true);
    void logout()
      .catch(() => {
        // 本地会话已在 logout 内清理；服务端撤销失败不阻塞退出。
      })
      .finally(() => {
        setLoggingOut(false);
      });
  }, [logout]);

  if (status === 'error') {
    return (
      <VerificationError
        onRetry={handleRetry}
        onLogout={handleLogout}
        retrying={retrying}
        loggingOut={loggingOut}
      />
    );
  }

  if (status !== 'authenticated' || user === null) {
    return <VerificationPlaceholder />;
  }

  return (
    <ConsoleShell
      audience={audienceFor(user)}
      activePath={pathname}
      accountLabel={accountLabelFor(user)}
      onNavigate={handleNavigate}
      accountActions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleLogout}
          loading={loggingOut}
        >
          退出登录
        </Button>
      }
    >
      {/* 换号时按 identityKey 重新挂载，清空旧账号的表单与临时 secret。 */}
      <React.Fragment key={identityKey}>{children}</React.Fragment>
    </ConsoleShell>
  );
}
