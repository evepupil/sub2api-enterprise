'use client';

import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/segmented-control';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { DonutChart } from '../../components/charts/donut-chart';
import type { BreakdownRow } from './types';
import { formatUsdCompact } from '../../lib/money';
import { formatUsageNumber, formatUsageUsd } from './usage-format';

type BreakdownMetric = 'tokens' | 'cost';

const METRIC_OPTIONS: ReadonlyArray<SegmentedOption<BreakdownMetric>> = [
  { value: 'tokens', label: '按 Token' },
  { value: 'cost', label: '按消费' },
];

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) < 1000 ? formatUsageNumber(value) : compactNumberFormatter.format(value);
}

export interface BreakdownCardProps {
  title: string;
  rows: readonly BreakdownRow[];
}

export function BreakdownCard({ title, rows }: BreakdownCardProps) {
  const [metric, setMetric] = useState<BreakdownMetric>('tokens');
  const chartRows = useMemo(
    () =>
      rows.map((row) => ({ name: row.label, value: metric === 'tokens' ? row.tokens : row.cost })),
    [metric, rows],
  );
  const chartTotal = chartRows.reduce((total, row) => total + row.value, 0);
  const firstColumnLabel =
    title === '模型分布'
      ? '模型'
      : title === '分组分布'
        ? '分组'
        : title === '接口分布'
          ? '接口'
          : '名称';
  const centerValue =
    metric === 'tokens' ? formatCompactNumber(chartTotal) : formatUsdCompact(chartTotal);
  const centerTitle =
    metric === 'tokens' ? formatUsageNumber(chartTotal) : formatUsageUsd(chartTotal);
  const centerLabel = metric === 'tokens' ? 'Token' : '消费';

  return (
    <Card className="min-w-0 gap-3 py-4">
      <CardHeader className="flex-row items-center justify-between gap-3 px-5">
        <CardTitle>{title}</CardTitle>
        <SegmentedControl
          size="sm"
          options={METRIC_OPTIONS}
          value={metric}
          onValueChange={setMetric}
          aria-label={`${title}统计维度`}
        />
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">所选日期没有用量</p>
        ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(132px,0.6fr)_minmax(0,1.4fr)] md:items-center">
            <div className="min-w-0">
              <DonutChart
                data={chartRows}
                centerValue={centerValue}
                centerLabel={centerLabel}
                centerTitle={centerTitle}
                ariaLabel={`${title}按${metric === 'tokens' ? 'Token' : '消费'}分布`}
                className="h-44 w-full"
              />
            </div>
            <Table data-density="compact" className="min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>{firstColumnLabel}</TableHead>
                  <TableHead className="text-right">请求</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                  <TableHead className="text-right">消费</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-48 break-words" title={row.label}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: `var(--chart-${(index % 6) + 1})` }}
                        />
                        <span className="min-w-0 break-words">{row.label || '未命名'}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatUsageNumber(row.requests)}</TableCell>
                    <TableCell className="text-right" title={formatUsageNumber(row.tokens)}>
                      {formatCompactNumber(row.tokens)}
                    </TableCell>
                    <TableCell className="text-right">{formatUsageUsd(row.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
