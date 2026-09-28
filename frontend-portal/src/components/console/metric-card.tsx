'use client';

import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader } from '../ui/card';

export interface MetricCardProps {
  /** 卡片标题，标题左侧固定显示 16px 单色图标。 */
  label: string;
  /** 已格式化好的主数值，展示层不再二次计算。 */
  value: string;
  /** 标题图标（Lucide 组件）。 */
  icon: LucideIcon;
  /** 可选的补充内容，展示在主数值下方。 */
  children?: React.ReactNode;
}

/**
 * 控制台统计卡：标题 14px + 16px 单色图标，数值 28px，四张卡等高。
 * 概览与组织用量共用，避免两套样式再次漂移。
 */
export function MetricCard({ label, value, icon: Icon, children }: MetricCardProps) {
  return (
    <Card className="h-full min-w-0 gap-3 py-4">
      <CardHeader className="flex-row items-center gap-2 px-5 pb-0">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col px-5">
        <p className="break-words text-page font-semibold tabular-nums">{value}</p>
        {children !== undefined ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">{children}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
