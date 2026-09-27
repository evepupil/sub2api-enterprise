'use client';

import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
import { formatUsageNumber, formatUsageUsd } from './usage-format';

type BreakdownMetric = 'tokens' | 'cost';

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

  return (
    <Card className="min-w-0 gap-4">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <div className="flex shrink-0 gap-1" role="group" aria-label={`${title}统计维度`}>
          <Button
            type="button"
            size="sm"
            variant={metric === 'tokens' ? 'default' : 'outline'}
            aria-pressed={metric === 'tokens'}
            onClick={() => setMetric('tokens')}
          >
            Token
          </Button>
          <Button
            type="button"
            size="sm"
            variant={metric === 'cost' ? 'default' : 'outline'}
            aria-pressed={metric === 'cost'}
            onClick={() => setMetric('cost')}
          >
            消费
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">所选日期没有用量</p>
        ) : (
          <>
            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(150px,0.6fr)_minmax(0,1.4fr)] md:items-center">
              <div className="min-w-0">
                {chartTotal > 0 ? (
                  <DonutChart
                    data={chartRows}
                    ariaLabel={`${title}按${metric === 'tokens' ? 'Token' : '消费'}分布`}
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
                    暂无可绘制的分布
                  </div>
                )}
              </div>
              <Table className="[&_th]:px-2 [&_td]:px-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead className="text-right">请求</TableHead>
                    <TableHead className="text-right">Token</TableHead>
                    <TableHead className="text-right">消费（USD）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-40 break-words" title={row.label}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: `var(--chart-${(index % 6) + 1})` }}
                          />
                          <span className="min-w-0 break-all">{row.label || '未命名'}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUsageNumber(row.requests)}
                      </TableCell>
                      <TableCell className="text-right">{formatUsageNumber(row.tokens)}</TableCell>
                      <TableCell className="text-right">{formatUsageUsd(row.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
