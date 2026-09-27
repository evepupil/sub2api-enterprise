'use client';

/**
 * 订单详情弹窗：状态查询、付款入口、待付款取消。
 *
 * 契约来源：design/console-pages.md 余额与订单章节、src/features/billing/validation.ts。
 *
 * 边界：
 * - 已创建订单的付款入口（PaymentLaunch）只保存在父组件内存，不写 storage、
 *   不打印日志；关闭弹窗即随卸载丢弃。
 * - 只有 PENDING / PAID / RECHARGING 继续查询状态；COMPLETED、EXPIRED、
 *   CANCELLED、FAILED 等终态立即停止，绝不对终态轮询。
 * - 轮询用「一次请求完成后才排下一次」的 setTimeout 链，不会并发堆积；
 *   查询失败不再自动重试，等用户手动重试，避免持续失败刷请求。
 * - 关闭弹窗（卸载）时取消定时器并 abort 在途请求；账号切换由父布局卸载本组件。
 * - 回跳只带订单编号时没有 PaymentLaunch，这里只查询状态并提供取消，
 *   不伪造付款地址、不自动创建新订单。
 */

import { useEffect, useRef, useState } from 'react';

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
import { Skeleton } from '../../components/ui/skeleton';
import type { ApiRequester } from '../auth/types';
import { cancelOrder, fetchOrder } from './api';
import type { PaymentLaunch, PaymentMethod, PaymentOrder } from './types';
import { formatBillingMoney, isOrderPending } from './validation';
import {
  OrderStatusBadge,
  formatOrderDateTime,
  formatOrderNumber,
  formatOrderUsd,
  paymentMethodLabel,
  safeErrorMessage,
} from './billing-ui-format';
import { PaymentCheckout } from './payment-checkout';

/** 规格固定：待入账订单每 3 秒查询一次状态。 */
export const ORDER_POLL_INTERVAL_MS = 3000;

interface DetailState {
  /** 当前详情对应的订单编号；与 props 不一致时视为未就绪。 */
  orderId: number | null;
  order: PaymentOrder | null;
  loading: boolean;
  error: string | null;
}

function idleDetail(orderId: number | null): DetailState {
  return { orderId, order: null, loading: orderId !== null, error: null };
}

/**
 * 订单状态查询与轮询。
 *
 * attempt 变化（用户点「查询订单状态」或取消后）会重新发起一次查询；
 * 每次请求完成后再决定是否排下一次，因此不会出现并发请求堆积。
 * 换单或卸载时立即取消定时器并 abort 在途请求。
 */
function useOrderStatus(
  request: ApiRequester,
  orderId: number | null,
  attempt: number,
): DetailState {
  const [state, setState] = useState<DetailState>(() => idleDetail(orderId));

  useEffect(() => {
    if (orderId === null) {
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function load() {
      try {
        const order = await fetchOrder(request, orderId as number, controller.signal);
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setState({ orderId, order, loading: false, error: null });
        // 只有等待入账的状态继续轮询；终态与失败都不再自动请求。
        if (isOrderPending(order.status)) {
          timer = setTimeout(() => {
            void load();
          }, ORDER_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setState({
          orderId,
          order: null,
          loading: false,
          error: safeErrorMessage(error, '订单状态查询失败，请稍后重试'),
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [orderId, request, attempt]);

  return state.orderId === orderId ? state : idleDetail(orderId);
}

export interface OrderDialogProps {
  /** 订单编号；null 表示未选中订单。 */
  orderId: number | null;
  /** 创建成功时后端返回的付款入口；回跳打开时没有。 */
  launch: PaymentLaunch | null;
  request: ApiRequester;
  /** 当前配置的支付方式，用于把 payment_type 展示成可读名称。 */
  methods: readonly PaymentMethod[];
  /** Stripe 可公开密钥；没有付款入口时不使用。 */
  stripePublicKey: string | null;
  onClose: () => void;
  /** 取消成功等写操作后刷新订单列表。 */
  onChanged: () => void;
  /** 已确认到账：刷新余额、身份与订单列表。 */
  onCompleted: () => void;
}

export function OrderDialog({
  orderId,
  launch,
  request,
  methods,
  stripePublicKey,
  onClose,
  onChanged,
  onCompleted,
}: OrderDialogProps) {
  // 换订单时用 key 重置这些一次性状态：同一次打开不会因轮询丢失确认提示。
  return (
    <OrderDialogBody
      key={orderId ?? 'closed'}
      orderId={orderId}
      launch={launch}
      request={request}
      methods={methods}
      stripePublicKey={stripePublicKey}
      onClose={onClose}
      onChanged={onChanged}
      onCompleted={onCompleted}
    />
  );
}

function OrderDialogBody({
  orderId,
  launch,
  request,
  methods,
  stripePublicKey,
  onClose,
  onChanged,
  onCompleted,
}: OrderDialogProps) {
  const [attempt, setAttempt] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const completedRef = useRef<number | null>(null);

  const detail = useOrderStatus(request, orderId, attempt);
  const order = detail.order;
  const completed = order !== null && order.status === 'COMPLETED';
  const canCancel = order !== null && order.status === 'PENDING';
  const pending = order !== null && isOrderPending(order.status);

  // 到账是服务端事实：只刷新一次，不用本地金额推算余额。
  useEffect(() => {
    if (!completed || order === null || completedRef.current === order.id) {
      return;
    }
    completedRef.current = order.id;
    setNotice('充值已到账，余额与订单列表已刷新。');
    onCompleted();
  }, [completed, order, onCompleted]);

  async function handleCancel() {
    if (order === null || cancelling) {
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(request, order.id);
      setNotice('订单已取消。');
      setConfirmCancel(false);
      onChanged();
      setAttempt((current) => current + 1);
    } catch (error) {
      setCancelError(safeErrorMessage(error, '取消订单失败，请稍后重试'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Dialog
      open={orderId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {orderId === null ? null : (
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
            <DialogDescription>付款完成后余额到账需要等待，到账以订单状态为准。</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {detail.loading && order === null ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : detail.error !== null && order === null ? (
              <Alert
                variant="destructive"
                title="订单状态查询失败"
                description={detail.error}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttempt((current) => current + 1)}
                  >
                    重试
                  </Button>
                }
              />
            ) : order === null ? (
              <Alert title="没有取到订单信息" description="请关闭后从订单列表重新打开。" />
            ) : (
              <>
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">订单号</dt>
                    <dd className="break-all text-right">{formatOrderNumber(order)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">充值金额</dt>
                    <dd className="tabular-nums">{formatOrderUsd(order.amount)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">应付金额</dt>
                    <dd className="tabular-nums">
                      {formatBillingMoney(order.payAmount, order.currency)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">支付方式</dt>
                    <dd>{paymentMethodLabel(order.method, methods)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">状态</dt>
                    <dd>
                      <OrderStatusBadge status={order.status} />
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">创建时间</dt>
                    <dd>{formatOrderDateTime(order.createdAt)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">截止时间</dt>
                    <dd>{formatOrderDateTime(order.expiresAt)}</dd>
                  </div>
                  {order.completedAt === null ? null : (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-muted-foreground">完成时间</dt>
                      <dd>{formatOrderDateTime(order.completedAt)}</dd>
                    </div>
                  )}
                </dl>

                {pending ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    正在等待付款结果，页面会自动查询订单状态。
                  </p>
                ) : null}

                {notice !== null ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {notice}
                  </p>
                ) : null}

                {order.status === 'PENDING' && launch !== null ? (
                  <PaymentCheckout
                    launch={launch}
                    stripePublicKey={stripePublicKey}
                    onCheck={() => setAttempt((current) => current + 1)}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {order.status === 'PENDING' ? (
                      <Alert
                        title="请按原支付渠道完成付款"
                        description="请回到原支付页面完成付款，再返回此处查询状态。"
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAttempt((current) => current + 1)}
                    >
                      查询订单状态
                    </Button>
                  </div>
                )}

                {cancelError !== null ? <Alert variant="destructive" title={cancelError} /> : null}
              </>
            )}
          </div>

          <DialogFooter>
            {canCancel && !confirmCancel ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setCancelError(null);
                  setConfirmCancel(true);
                }}
              >
                取消订单
              </Button>
            ) : null}
            {canCancel && confirmCancel ? (
              <Button type="button" variant="outline" onClick={() => setConfirmCancel(false)}>
                保留订单
              </Button>
            ) : null}
            {canCancel && confirmCancel ? (
              <Button
                type="button"
                variant="destructive"
                loading={cancelling}
                onClick={() => void handleCancel()}
              >
                确认取消
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
