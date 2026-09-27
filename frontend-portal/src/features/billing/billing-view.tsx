'use client';

/**
 * 余额与订单页面（/console/billing）。
 *
 * 契约来源：design/console-pages.md 余额与订单章节、DESIGN.md 主题与控件约定、
 * src/features/billing/{types,api,validation}.ts。
 *
 * 边界：
 * - 普通组织成员没有余额充值权限：本组件不请求 /payment/config 与订单，
 *   只渲染无权卡片并给出概览入口（真实权限仍由后端判定）。
 * - 余额来自 usage/api 的 fetchCurrentFunds：个人与组织管理员看 /user/profile 的
 *   可用余额与冻结金额，普通成员看组织配额（不在这里重复实现）。
 * - 充值配置未开启或余额充值关闭时，只隐藏充值表单，余额卡与订单列表照常渲染，
 *   已有订单不会因为配置变化而消失。
 * - 创建订单不自动重试：失败或超时只提示先查订单；付款入口只存在内存中。
 * - 回跳参数（order_id / payment_order_id）只用于打开详情查询；订单编号按身份
 *   记在 sessionStorage 以便无编号回跳时恢复，绝不保存任何支付秘密。
 */

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { PageHeader } from '../../components/layout/page-header';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../auth/auth-provider';
import type { PortalUser } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { fetchCurrentFunds } from '../usage/api';
import type { CurrentFunds } from '../usage/types';
import { fetchBillingConfig, createPaymentOrder } from './api';
import { BILLING_RETURN_PATH } from './adapter';
import { RechargeForm, type RechargeSubmitInput } from './recharge-form';
import { OrderList } from './order-list';
import { OrderDialog } from './order-dialog';
import type { PaymentLaunch } from './types';
import { formatBillingMoney } from './validation';
import { safeErrorMessage } from './billing-ui-format';

/** 无订单编号回跳时恢复上次查看的订单，只存编号，不存任何支付秘密。 */
const LAST_ORDER_STORAGE_PREFIX = 'billing.lastOrderId';

/** 登录身份标识前缀：换号后不会读到上一个账号的订单编号。 */
function lastOrderStorageKey(identityKey: string): string {
  return `${LAST_ORDER_STORAGE_PREFIX}:${identityKey}`;
}

function readLastOrderId(identityKey: string): number | null {
  if (typeof window === 'undefined' || identityKey === '') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(lastOrderStorageKey(identityKey));
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeLastOrderId(identityKey: string, orderId: number | null): void {
  if (typeof window === 'undefined' || identityKey === '') {
    return;
  }
  try {
    const key = lastOrderStorageKey(identityKey);
    if (orderId === null) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, String(orderId));
  } catch {
    // 存储不可用只影响回跳恢复，不影响下单与查询。
  }
}

/** 普通组织成员：属于组织但不是创建者，无余额充值权限。 */
function isPlainMember(user: PortalUser): boolean {
  return user.organization !== null && !user.organization.isOwner;
}

/** 用户可手动重试的请求错误。 */
function errorMessage(error: unknown, fallback: string): string {
  return safeErrorMessage(error, fallback);
}

export interface BillingViewProps {
  /** 支付回跳携带的订单编号（order_id 或 payment_order_id 由路由统一解析）。 */
  initialOrderId?: number;
}

export function BillingView({ initialOrderId }: BillingViewProps) {
  const { request, user, identityKey, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const member = user !== null && isPlainMember(user);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(() => {
    if (initialOrderId !== undefined) {
      return initialOrderId;
    }
    // 回跳没有订单编号时，用本账号上次查看的订单恢复详情（只存编号，无支付秘密）。
    // 初始值在挂载时同步读取，避免在 effect 里再改一次状态造成级联渲染。
    return readLastOrderId(identityKey);
  });
  const [launch, setLaunch] = useState<PaymentLaunch | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 回跳带来的订单编号也记下来（只存编号），刷新或去掉参数后仍能恢复详情。
  useEffect(() => {
    if (initialOrderId !== undefined) {
      writeLastOrderId(identityKey, initialOrderId);
    }
  }, [initialOrderId, identityKey]);

  const funds = usePortalQuery(
    ['billing', 'funds'],
    (apiRequest, signal) => {
      if (user === null) {
        return Promise.reject(new Error('缺少账号信息'));
      }
      return fetchCurrentFunds(apiRequest, user, signal);
    },
    { enabled: !member && user !== null },
  );

  const config = usePortalQuery(
    ['billing', 'config'],
    (apiRequest, signal) => fetchBillingConfig(apiRequest, signal),
    { enabled: !member && user !== null },
  );

  const handleCompleted = useCallback(() => {
    // 到账后余额与身份都需要重新核实，订单列表由查询失效统一刷新。
    void queryClient.invalidateQueries({ queryKey: ['portal'] });
    void refreshUser().catch(() => {
      // 刷新身份失败不影响已到账的订单展示，页面会保留服务端返回的状态。
    });
  }, [queryClient, refreshUser]);

  const handleSelectOrder = useCallback(
    (orderId: number) => {
      setLaunch(null);
      setSelectedOrderId(orderId);
      writeLastOrderId(identityKey, orderId);
    },
    [identityKey],
  );

  const handleCloseOrder = useCallback(() => {
    setSelectedOrderId(null);
    setLaunch(null);
    writeLastOrderId(identityKey, null);
  }, [identityKey]);

  const handleChanged = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['portal'] });
  }, [queryClient]);

  async function handleSubmitRecharge({ amount, method }: RechargeSubmitInput) {
    if (creating) {
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      // 回跳地址只允许本站 /console/billing：不带订单编号，回跳后由本账号记录的
      // 订单编号恢复详情（后端会用 return_url 作为付款完成后的落地页）。
      if (typeof window === 'undefined' || window.location.origin === '') {
        throw new Error('当前环境没有可用的站点地址，请稍后重试');
      }
      const returnUrl = new URL(BILLING_RETURN_PATH, window.location.origin).toString();
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const created = await createPaymentOrder(request, {
        amount,
        methodId: method.id,
        returnUrl,
        isMobile,
      });
      // 付款入口只留在内存；订单编号按身份记录，便于回跳后恢复查询。
      setLaunch(created);
      setSelectedOrderId(created.orderId);
      writeLastOrderId(identityKey, created.orderId);
      void queryClient.invalidateQueries({ queryKey: ['portal'] });
    } catch (error) {
      setCreateError(errorMessage(error, '创建订单失败，请稍后重试'));
    } finally {
      setCreating(false);
    }
  }

  if (member) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="余额与订单" />
        <Card>
          <CardContent>
            <EmptyState
              title="当前账号没有余额充值权限"
              description="组织成员的额度由组织管理员统一分配。如需充值或查看订单，请联系管理员。"
              action={
                <Button asChild variant="outline">
                  <Link href="/console">返回概览</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const balanceCard = (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>账户余额</CardTitle>
      </CardHeader>
      <CardContent>
        {funds.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : funds.isError ? (
          <Alert
            variant="destructive"
            title="余额加载失败"
            description={errorMessage(funds.error, '请检查网络后重试')}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void funds.refetch()}
              >
                重试
              </Button>
            }
          />
        ) : funds.data === undefined ? (
          <EmptyState title="暂时没有余额信息" description="请稍后刷新重试。" />
        ) : (
          <FundsSummary funds={funds.data} />
        )}
      </CardContent>
    </Card>
  );

  const rechargeSection = (() => {
    if (config.isPending) {
      return (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>余额充值</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-40" />
            </div>
          </CardContent>
        </Card>
      );
    }
    if (config.isError) {
      return (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>余额充值</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert
              variant="destructive"
              title="充值配置加载失败"
              description={errorMessage(config.error, '请检查网络后重试')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void config.refetch()}
                >
                  重试
                </Button>
              }
            />
          </CardContent>
        </Card>
      );
    }
    if (config.data === undefined || !config.data.enabled) {
      return (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>余额充值</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState title="暂未开通充值" description="已创建的订单和余额仍然可以查看。" />
          </CardContent>
        </Card>
      );
    }
    return (
      <RechargeForm
        config={config.data}
        methods={config.data.methods}
        submitting={creating}
        submitError={createError}
        onSubmit={(input) => void handleSubmitRecharge(input)}
        onCheckOrders={() => {
          // 下单失败或超时：先刷新订单列表，再打开本账号记录的订单详情，
          // 让用户确认是否已创建成功；这里不会自动重建订单。
          handleChanged();
          if (selectedOrderId === null) {
            const remembered = readLastOrderId(identityKey);
            if (remembered !== null) {
              setSelectedOrderId(remembered);
            }
          }
        }}
      />
    );
  })();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="余额与订单" />

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        {balanceCard}
        {rechargeSection}
      </div>

      <OrderList
        request={request}
        methods={config.data?.methods ?? []}
        onSelect={handleSelectOrder}
        onChanged={handleChanged}
      />

      <OrderDialog
        orderId={selectedOrderId}
        launch={launch}
        request={request}
        methods={config.data?.methods ?? []}
        stripePublicKey={config.data?.stripePublicKey ?? null}
        onClose={handleCloseOrder}
        onChanged={handleChanged}
        onCompleted={handleCompleted}
      />
    </div>
  );
}

/** 余额与冻结金额：个人与组织管理员都按后端 profile 的数值展示。 */
function FundsSummary({ funds }: { funds: CurrentFunds }) {
  if (funds.kind === 'quota') {
    return (
      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted-foreground">可用配额</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {funds.amount === null ? '—' : formatBillingMoney(funds.amount, 'USD')}
          </dd>
        </div>
      </dl>
    );
  }
  return (
    <dl className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-muted-foreground">可用余额</dt>
        <dd className="text-xl font-semibold tabular-nums">
          {formatBillingMoney(funds.amount, 'USD')}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-muted-foreground">冻结金额</dt>
        <dd className="tabular-nums">{formatBillingMoney(funds.frozen, 'USD')}</dd>
      </div>
    </dl>
  );
}
