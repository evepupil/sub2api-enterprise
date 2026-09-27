'use client';

import * as React from 'react';

import { PageHeader } from '../../components/layout/page-header';
import { DateRangeControl } from '../../components/console/date-range-control';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
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
import { useAuth } from '../auth/auth-provider';
import { usePortalQuery } from '../console/use-portal-query';
import { fetchKeys } from '../keys/api';
import { getPresetRange } from '../../lib/time/date-range';
import { fetchUsageRecords } from './api';
import type { DateRange, UsageFilters, UsageRecord } from './types';
import {
  UsageRecordDetail,
  formatUsageDateTime,
  formatUsageDuration,
  formatUsageNumber,
  formatUsageUsd,
} from './usage-record-detail';

/** 明细固定每页 20 条。 */
const PAGE_SIZE = 20;
/** 密钥下拉最多请求 200 条，够覆盖常见账号且不拖慢首屏。 */
const KEY_PAGE_SIZE = 200;
/** 「全部密钥」在 Radix Select 中的占位值（value 必须是字符串）。 */
const ALL_KEYS = '__all__';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return '请求失败，请稍后重试';
}

export interface UsageViewProps {
  /** 从密钥页带入的 api_key_id；即使不在密钥列表中也要保留为「密钥 #id」。 */
  initialKeyId?: number;
}

/**
 * 用量明细页：日期范围（与总览共用 DateRangeControl）、模型文本筛选、
 * 密钥下拉、查询/重置，20 条一页的明细表与记录详情弹窗。
 *
 * 数据边界：
 * - 请求只走 usage/api 的 fetchUsageRecords 与 keys/api 的 fetchKeys；
 * - queryKey 含范围、页码与全部筛选，切换后不保留上一范围的数据；
 * - 加载 / 错误 / 空态各自独立，失败不显示为 0 或空记录；
 * - 明细只展示 api_key 名称，不展示任何密钥秘密。
 */
export function UsageView({ initialKeyId }: UsageViewProps) {
  const { request } = useAuth();

  const [range, setRange] = React.useState<DateRange>(() => getPresetRange('last7'));
  const [page, setPage] = React.useState(1);
  const [modelDraft, setModelDraft] = React.useState('');
  const [model, setModel] = React.useState('');
  const [keyId, setKeyId] = React.useState<number | undefined>(initialKeyId);
  const [selected, setSelected] = React.useState<UsageRecord | null>(null);

  const filters = React.useMemo<UsageFilters>(() => {
    const next: UsageFilters = { range, page, pageSize: PAGE_SIZE };
    if (model !== '') next.model = model;
    if (keyId !== undefined) next.keyId = keyId;
    return next;
  }, [range, page, model, keyId]);

  const records = usePortalQuery(
    ['usage', 'records', range.start, range.end, range.timeZone, page, model, keyId ?? null],
    (_request, signal) => fetchUsageRecords(request, filters, signal),
  );

  const keys = usePortalQuery(['usage', 'key-options'], (_request, signal) =>
    fetchKeys(request, { page: 1, pageSize: KEY_PAGE_SIZE }, signal),
  );

  const keyOptions = keys.data?.items ?? [];
  const keyIdInList = keyId !== undefined && keyOptions.some((item) => item.id === keyId);

  const applyRange = (next: DateRange): void => {
    setRange(next);
    setPage(1);
  };

  const applyModel = (): void => {
    setModel(modelDraft.trim());
    setPage(1);
  };

  const reset = (): void => {
    setRange(getPresetRange('last7'));
    setModelDraft('');
    setModel('');
    setKeyId(undefined);
    setPage(1);
  };

  const items = records.data?.items ?? [];
  const total = records.data?.total ?? 0;
  const pages = records.data?.pages ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="用量明细" />

      <Card className="min-w-0">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">日期范围</span>
              <DateRangeControl value={range} onChange={applyRange} className="md:min-w-64" />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="usage-model" className="text-xs text-muted-foreground">
                模型
              </Label>
              <Input
                id="usage-model"
                value={modelDraft}
                placeholder="按模型名筛选"
                className="md:w-56"
                onChange={(event) => setModelDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyModel();
                  }
                }}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">密钥</span>
              <Select
                value={keyId === undefined ? ALL_KEYS : String(keyId)}
                onValueChange={(next) => {
                  setKeyId(next === ALL_KEYS ? undefined : Number(next));
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="密钥" className="md:w-56">
                  <SelectValue placeholder="全部密钥" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_KEYS}>全部密钥</SelectItem>
                  {keyId !== undefined && !keyIdInList ? (
                    <SelectItem value={String(keyId)}>{`密钥 #${keyId}`}</SelectItem>
                  ) : null}
                  {keyOptions.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name.trim() === '' ? `密钥 #${item.id}` : item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={applyModel}>查询</Button>
              <Button variant="outline" onClick={reset}>
                重置
              </Button>
            </div>
          </div>
          {keys.isError ? (
            <p role="status" className="text-xs text-muted-foreground">
              密钥列表加载失败，仍可按密钥 ID 筛选。
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>调用记录</CardTitle>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          {records.isPending ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : records.isError ? (
            <Alert
              variant="destructive"
              title="用量明细加载失败"
              description={errorMessage(records.error)}
              action={
                <Button variant="outline" size="sm" onClick={() => void records.refetch()}>
                  重试
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="所选日期没有调用记录"
              description="可调整日期范围或清空筛选后重试。"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
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
                      {formatUsageDateTime(record.createdAt, range.timeZone)}
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
                    <TableCell className="text-right">
                      {formatUsageUsd(record.actualCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsageDuration(record.durationMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {records.isSuccess && total > 0 ? (
            <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
              <p role="status" className="text-xs text-muted-foreground">
                共 {formatUsageNumber(total)} 条 · 第 {records.data?.page ?? page} /{' '}
                {Math.max(pages, 1)} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pages === 0 || page >= pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <UsageRecordDetail
        record={selected}
        timeZone={range.timeZone}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
