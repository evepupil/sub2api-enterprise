'use client';

/**
 * 页面 15 的成员分布卡：全组织成员消费环图 + 成员表。
 *
 * 契约来源：design/team-and-delivery.md 页面 15、organization-usage/types.ts。
 *
 * 边界：
 * - 数据来自 /usage/organization/members，后端固定返回全组织分布，不接受单成员
 *   筛选，因此本卡只跟随日期范围；标题与说明明确写「全组织成员分布」，避免
 *   被误认为随上方成员筛选收窄。
 * - 分布行只表示「该日期范围内有用量的成员」，不能当作组织成员总数。
 * - 只做展示与行选择；点击行或「查看」把筛选切换为对应成员（分页由父组件重置）。
 * - 不在展示层重新聚合请求 / Token / 消费，直接使用适配后的成员行。
 */

import { useMemo, useState } from 'react';

import {
  SlidingIndicator,
  useSlidingIndicatorId,
} from '../../components/effects/sliding-indicator';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { DonutChart } from '../../components/charts/donut-chart';
import { cn } from '../../lib/utils';
import type { MemberUsageRow } from './types';
import { formatUsageNumber, formatUsageUsd } from '../usage/usage-format';

type MemberMetric = 'tokens' | 'cost';

/** 姓名兜底顺序：display_name → username → email → 成员 #id（与成员模块一致）。 */
export function memberUsageLabel(row: MemberUsageRow): string {
  return row.displayName.trim() || row.username.trim() || row.email.trim() || `成员 #${row.userId}`;
}

export interface MemberDistributionCardProps {
  /** 全组织成员分布行（已由适配层解析，可能是空数组）。 */
  rows: readonly MemberUsageRow[];
  /** 当前统计对象（undefined 表示全组织），用于标出选中行。 */
  selectedMemberId: number | undefined;
  /** 点击行或「查看」：把统计对象切换为该成员。 */
  onSelectMember: (memberId: number) => void;
}

export function MemberDistributionCard({
  rows,
  selectedMemberId,
  onSelectMember,
}: MemberDistributionCardProps) {
  const [metric, setMetric] = useState<MemberMetric>('tokens');
  const indicatorId = useSlidingIndicatorId();
  const chartRows = useMemo(
    () =>
      rows.map((row) => ({
        name: memberUsageLabel(row),
        value: metric === 'tokens' ? row.tokens : row.actualCost,
      })),
    [metric, rows],
  );
  const chartTotal = chartRows.reduce((total, row) => total + row.value, 0);

  return (
    <Card className="min-w-0 gap-4">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>全组织成员分布</CardTitle>
        <div
          className="flex shrink-0 gap-1 isolate"
          role="group"
          aria-label="全组织成员分布统计维度"
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={metric === 'tokens'}
            className={cn(
              'relative',
              metric === 'tokens' && 'border-transparent text-primary-foreground',
            )}
            onClick={() => setMetric('tokens')}
          >
            {metric === 'tokens' ? <SlidingIndicator layoutId={indicatorId} pace="quick" /> : null}
            <span className="sliding-indicator-label">Token</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={metric === 'cost'}
            className={cn(
              'relative',
              metric === 'cost' && 'border-transparent text-primary-foreground',
            )}
            onClick={() => setMetric('cost')}
          >
            {metric === 'cost' ? <SlidingIndicator layoutId={indicatorId} pace="quick" /> : null}
            <span className="sliding-indicator-label">消费</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <p className="text-xs text-muted-foreground">
          只跟随日期范围，不受上方成员筛选影响；仅列出所选日期内有用量的成员，行数不等于组织成员总数。
        </p>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">所选日期没有成员用量</p>
        ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(150px,0.6fr)_minmax(0,1.4fr)] md:items-center">
            <div className="min-w-0">
              {chartTotal > 0 ? (
                <DonutChart
                  data={chartRows}
                  ariaLabel={`全组织成员分布按${metric === 'tokens' ? 'Token' : '消费'}占比`}
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
                  暂无可绘制的分布
                </div>
              )}
            </div>
            <Table className="min-w-table [&_th]:px-2 [&_td]:px-2" aria-label="全组织成员分布">
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead className="text-right">请求</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                  <TableHead className="text-right">消费（USD）</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const label = memberUsageLabel(row);
                  const selected = row.userId === selectedMemberId;
                  return (
                    <TableRow
                      key={row.userId}
                      role="button"
                      tabIndex={0}
                      aria-label={`按成员 ${label} 查看用量`}
                      aria-pressed={selected}
                      data-member-id={row.userId}
                      className={selected ? 'cursor-pointer bg-muted/50' : 'cursor-pointer'}
                      onClick={() => onSelectMember(row.userId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectMember(row.userId);
                        }
                      }}
                    >
                      <TableCell className="max-w-56 break-words" title={label}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: `var(--chart-${(index % 6) + 1})` }}
                          />
                          <span className="min-w-0 break-all">{label}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUsageNumber(row.requests)}
                      </TableCell>
                      <TableCell className="text-right">{formatUsageNumber(row.tokens)}</TableCell>
                      <TableCell className="text-right">{formatUsageUsd(row.actualCost)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`查看成员 ${label} 的用量`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectMember(row.userId);
                          }}
                        >
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
