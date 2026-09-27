'use client';

/**
 * 订单列表：状态筛选、20 条分页、刷新、查看详情与取消待付款订单。
 *
 * 契约来源：design/console-pages.md 余额与订单章节、src/features/billing/validation.ts。
 *
 * 边界：
 * - 数据只走本模块 fetchOrders；queryKey 含状态与页码，切筛选不混用旧页数据。
 * - 充值金额列按 USD 展示（后端已换算的到账额），应付金额按订单币种展示。
 * - 取消只允许 PENDING，并且必须二次确认；写操作不重试，成功后刷新列表。
 * - 加载失败不显示为空订单；配置禁用时列表仍然渲染（父组件不卸载本组件）。
 */

import { useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { cancelOrder, fetchOrders } from './api';
import type { PaymentMethod, PaymentOrder } from './types';
import { formatBillingMoney } from './validation';
import {
  OrderStatusBadge,
  formatOrderDateTime,
  formatOrderNumber,
  formatOrderUsd,
  paymentMethodLabel,
  safeErrorMessage,
} from './billing-ui-format';

/** 规格固定：订单列表每页 20 条。 */
export const ORDERS_PAGE_SIZE = 20;

/** 「全部状态」在 Radix Select 里的哨兵值（item value 不能为空字符串）。 */
const ANY_STATUS = '__any__';

/** 与后端冻结的订单状态枚举一致；UNKNOWN 不作为筛选条件。 */
const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: ANY_STATUS, label: '全部状态' },
  { value: 'PENDING', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'RECHARGING', label: '入账中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'EXPIRED', label: '已过期' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'FAILED', label: '支付失败' },
  { value: 'REFUND_REQUESTED', label: '退款申请中' },
  { value: 'REFUNDING', label: '退款中' },
  { value: 'REFUND_PENDING', label: '退款处理中' },
  { value: 'PARTIALLY_REFUNDED', label: '部分退款' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'REFUND_FAILED', label: '退款失败' },
];

export interface OrderListProps {
  request: ApiRequester;
  /** 配置里的支付方式，用于把 payment_type 显示成可读名称。 */
  methods: readonly PaymentMethod[];
  /** 打开订单详情；创建成功与回跳都走这里。 */
  onSelect: (orderId: number) => void;
  /** 取消成功后通知父组件刷新余额等派生数据。 */
  onChanged: () => void;
}

export function OrderList({ request, methods, onSelect, onChanged }: OrderListProps) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(ANY_STATUS);
  const [confirming, setConfirming] = useState<PaymentOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const orders = usePortalQuery(
    ['billing', 'orders', page, ORDERS_PAGE_SIZE, status === ANY_STATUS ? '' : status],
    (_request, signal) =>
      fetchOrders(
        request,
        {
          page,
          pageSize: ORDERS_PAGE_SIZE,
          ...(status === ANY_STATUS ? {} : { status }),
        },
        signal,
      ),
  );

  const items = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const pages = orders.data?.pages ?? 0;

  async function handleCancel() {
    if (confirming === null || cancelling) {
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(request, confirming.id);
      setConfirming(null);
      await orders.refetch();
      onChanged();
    } catch (error) {
      setCancelError(safeErrorMessage(error, '取消订单失败，请稍后重试'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <CardTitle>订单记录</CardTitle>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex w-full flex-col gap-2 md:w-48">
            <Label htmlFor="orders-status" className="text-xs text-muted-foreground">
              状态
            </Label>
            <Select
              value={status}
              onValueChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
            >
              <SelectTrigger id="orders-status" aria-label="订单状态">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void orders.refetch()}
            loading={orders.isFetching && !orders.isPending}
          >
            刷新
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-w-0 flex-col gap-4">
        {orders.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.isError ? (
          <Alert
            variant="destructive"
            title="订单列表加载失败"
            description={safeErrorMessage(orders.error, '请检查网络后重试')}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void orders.refetch()}
              >
                重试
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={status === ANY_STATUS ? '还没有充值订单' : '没有符合该状态的订单'}
            description={
              status === ANY_STATUS
                ? '创建充值订单后可以在这里查看状态。'
                : '可以切换状态筛选查看其他订单。'
            }
          />
        ) : (
          <>
            <Table className="min-w-table">
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead className="text-right">充值金额</TableHead>
                  <TableHead className="text-right">应付金额</TableHead>
                  <TableHead>支付方式</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatOrderDateTime(order.createdAt)}
                    </TableCell>
                    <TableCell className="break-all">{formatOrderNumber(order)}</TableCell>
                    <TableCell className="text-right">{formatOrderUsd(order.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {formatBillingMoney(order.payAmount, order.currency)}
                    </TableCell>
                    <TableCell className="break-words">
                      {paymentMethodLabel(order.method, methods)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onSelect(order.id)}
                        >
                          查看
                        </Button>
                        {order.status === 'PENDING' ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setCancelError(null);
                              setConfirming(order);
                            }}
                          >
                            取消
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
              <p role="status" className="text-sm text-muted-foreground">
                共 {total} 条记录，第 {orders.data?.page ?? page}
                {pages > 0 ? ` / ${pages}` : ''} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pages === 0 || page >= pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setConfirming(null);
            setCancelError(null);
          }
        }}
      >
        {confirming === null ? null : (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>取消这笔订单？</DialogTitle>
              <DialogDescription>
                订单 {formatOrderNumber(confirming)} · 充值金额 {formatOrderUsd(confirming.amount)}
                。取消后订单无法继续支付，需要重新下单。
              </DialogDescription>
            </DialogHeader>
            {cancelError !== null ? (
              <div className="mt-4">
                <Alert variant="destructive" title={cancelError} />
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={() => {
                  setConfirming(null);
                  setCancelError(null);
                }}
              >
                保留订单
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={cancelling}
                onClick={() => void handleCancel()}
              >
                确认取消
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
