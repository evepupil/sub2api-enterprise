'use client';

/**
 * 页面 15 的调用明细表：时间、成员、模型、密钥名称、四类 Token、实际消费、耗时。
 *
 * 契约来源：design/team-and-delivery.md 页面 15、organization-usage/types.ts、
 * features/usage/usage-record-detail.tsx 的既有签名。
 *
 * 边界：
 * - 复用 M3 的 UsageRecordDetail 弹窗（OrganizationUsageRecord 是 UsageRecord 的
 *   扩展，含 userId/userLabel），不复制整页明细，也不新增密钥秘密字段。
 * - 只渲染传入的已解析分页数据；分页、范围与成员筛选由父组件持有，
 *   日期或成员变更时父组件重置到第 1 页。
 * - 表格在卡内横向滚动（min-w-table），长名称折行；无数据 / 错误 / 加载
 *   三种状态各自明确，不用 0 或空表掩盖失败。
 */

import { useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import type { OrganizationUsageRecord } from './types';
import {
  UsageRecordDetail,
  formatUsageDateTime,
  formatUsageDuration,
} from '../usage/usage-record-detail';
import { formatUsageNumber, formatUsageUsd } from '../usage/usage-format';

export interface OrganizationRecordsCardProps {
  /** 当前页明细；加载中或失败时父组件传空数组。 */
  items: readonly OrganizationUsageRecord[];
  /** 服务端返回的总条数与总页数。 */
  total: number;
  pages: number;
  /** 当前页码（父组件持有，变更时重新查询）。 */
  page: number;
  /** 当前范围的统一时区，用于时间展示。 */
  timeZone: string;
  isPending: boolean;
  isError: boolean;
  errorText: string;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

export function OrganizationRecordsCard({
  items,
  total,
  pages,
  page,
  timeZone,
  isPending,
  isError,
  errorText,
  onRetry,
  onPageChange,
}: OrganizationRecordsCardProps) {
  const [selected, setSelected] = useState<OrganizationUsageRecord | null>(null);
  const hasPrevious = page > 1;
  const hasNext = pages > 0 && page < pages;

  return (
    <Card className="min-w-0 gap-4">
      <CardHeader>
        <CardTitle>调用明细</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <Alert
            variant="destructive"
            title="组织调用明细加载失败"
            description={errorText}
            action={
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                重试
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="所选范围没有调用记录"
            description="可调整日期范围，或把统计对象切回全组织后重试。"
          />
        ) : (
          <Table className="min-w-table" aria-label="组织调用明细">
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>成员</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>密钥名称</TableHead>
                <TableHead className="text-right">输入</TableHead>
                <TableHead className="text-right">缓存写入</TableHead>
                <TableHead className="text-right">缓存读取</TableHead>
                <TableHead className="text-right">输出</TableHead>
                <TableHead className="text-right">实际消费 USD</TableHead>
                <TableHead className="text-right">耗时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((record) => (
                <TableRow
                  key={record.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`查看记录 ${record.id} 详情`}
                  data-record-id={record.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(record)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(record);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap">
                    {formatUsageDateTime(record.createdAt, timeZone)}
                  </TableCell>
                  <TableCell className="max-w-48 break-words" title={record.userLabel}>
                    {record.userLabel}
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate whitespace-normal break-words"
                    title={record.model}
                  >
                    {record.model}
                  </TableCell>
                  <TableCell className="break-words">
                    {record.keyName.trim() === '' ? `密钥 #${record.keyId}` : record.keyName}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsageNumber(record.tokens.input)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsageNumber(record.tokens.cacheWrite)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsageNumber(record.tokens.cacheRead)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUsageNumber(record.tokens.output)}
                  </TableCell>
                  <TableCell className="text-right">{formatUsageUsd(record.actualCost)}</TableCell>
                  <TableCell className="text-right">
                    {formatUsageDuration(record.durationMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isPending && !isError && total > 0 ? (
          <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
            <p role="status" className="text-xs text-muted-foreground">
              共 {formatUsageNumber(total)} 条 · 第 {page} / {Math.max(pages, 1)} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrevious}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => onPageChange(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <UsageRecordDetail
        record={selected}
        timeZone={timeZone}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </Card>
  );
}
