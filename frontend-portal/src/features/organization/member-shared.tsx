'use client';

/**
 * 组织成员模块的共享工具：安全错误文案、组织数据失效刷新、周期额度字段与变更提示。
 *
 * 契约来源：design/team-and-delivery.md 页面 14、DESIGN.md 第 4 章控件契约、
 * src/features/organization/types.ts 与冻结的 api.ts / validation.ts 导出。
 *
 * 边界：
 * - 组织界面错误文案统一由 errors.ts 处理，不透传后端原文、内部字段名或异常栈。
 * - 数据变更后统一失效 ['portal', identityKey, 'organization']；只有变更影响
 *   当前登录账号自身时才另外 refreshUser 刷新资金与身份。
 * - 周期字段只编辑 QuotaDraft 文本状态，金额/天数的解析与载荷构造全部由
 *   validation.ts 负责，这里不自行换算或猜测空值。
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../auth/auth-provider';
import type { OrganizationMember, QuotaDraft } from './types';

/** 所有者与未知状态成员都不能执行成员管理写操作。 */
export function canManageMember(member: Pick<OrganizationMember, 'isOwner' | 'status'>): boolean {
  return !member.isOwner && member.status !== 'unknown';
}

export interface OrganizationRefreshOptions {
  /** 本次变更影响当前登录账号自身（名称或额度）时，需要一并刷新身份与资金。 */
  self?: boolean;
}

/**
 * 组织数据变更后的统一刷新：失效本账号的组织查询缓存，必要时再刷新身份。
 * 返回的函数不会抛出（身份刷新失败不影响组织数据展示）。
 */
export function useOrganizationRefresh(): (options?: OrganizationRefreshOptions) => Promise<void> {
  const { identityKey, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    async (options: OrganizationRefreshOptions = {}) => {
      await queryClient.invalidateQueries({ queryKey: ['portal', identityKey, 'organization'] });
      if (options.self === true) {
        try {
          await refreshUser();
        } catch {
          // 身份刷新失败不回滚已完成的组织数据变更，页面保留服务端权威值。
        }
      }
    },
    [identityKey, queryClient, refreshUser],
  );
}

export interface QuotaPeriodicFieldsProps {
  draft: QuotaDraft;
  disabled: boolean;
  /** 同一页面可能出现多个草稿表单，用于生成唯一控件 id。 */
  idPrefix: string;
  onChange: (patch: Partial<QuotaDraft>) => void;
}

/** 周期额度字段：金额、天数与生效方式；只处理文本状态，不做业务校验。 */
export function QuotaPeriodicFields({
  draft,
  disabled,
  idPrefix,
  onChange,
}: QuotaPeriodicFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-amount`}>周期金额（USD）</Label>
          <Input
            id={`${idPrefix}-amount`}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={draft.amount}
            disabled={disabled}
            onChange={(event) => onChange({ amount: event.currentTarget.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-days`}>周期天数</Label>
          <Input
            id={`${idPrefix}-days`}
            name="period_days"
            inputMode="numeric"
            autoComplete="off"
            value={draft.periodDays}
            disabled={disabled}
            onChange={(event) => onChange({ periodDays: event.currentTarget.value })}
          />
        </div>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium text-foreground">生效方式</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-starts`}
            className="mt-1 size-4 accent-primary"
            checked={draft.starts === 'now'}
            onChange={() => onChange({ starts: 'now' })}
          />
          <span>立即生效（开启新周期，重置当期已用）</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={`${idPrefix}-starts`}
            className="mt-1 size-4 accent-primary"
            checked={draft.starts === 'date'}
            onChange={() => onChange({ starts: 'date' })}
          />
          <span>指定日期生效</span>
        </label>
        {draft.starts === 'date' ? (
          <div className="space-y-2 pt-2">
            <Label htmlFor={`${idPrefix}-date`}>生效日期</Label>
            <Input
              id={`${idPrefix}-date`}
              name="start_date"
              type="date"
              value={draft.startDate}
              disabled={disabled}
              onChange={(event) => onChange({ startDate: event.currentTarget.value })}
            />
            <p className="text-xs text-muted-foreground">
              只选择日期，按浏览器本地时间 00:00 生效。
            </p>
          </div>
        ) : null}
      </fieldset>

      <p className="text-xs text-muted-foreground">周期天数 1 到 3650 天；金额最多 8 位小数。</p>
    </div>
  );
}

/**
 * 额度变更的必须说明：立即生效会开启新周期并重置当期已用；
 * 从周期额度切回固定上限会结束当前周期但保留已消费金额。
 */
export function quotaChangeNotices(draft: QuotaDraft, hasPeriodicQuota: boolean): string[] {
  const notices: string[] = [];
  if (draft.mode === 'periodic') {
    notices.push(
      draft.starts === 'now'
        ? '保存后会立即开启新周期，当期已用额度将被重置为 0。'
        : hasPeriodicQuota
          ? '保存后会在指定日期开启新周期；到期前当前周期继续生效。'
          : '保存后会在指定日期开启新周期；到期前当前额度继续生效。',
    );
  } else if (hasPeriodicQuota) {
    notices.push('保存后该成员将退出周期额度并结束当前周期；已消费金额保留，不会清零。');
  }
  return notices;
}
