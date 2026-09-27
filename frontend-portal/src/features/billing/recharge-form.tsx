'use client';

/**
 * 余额充值卡：预设金额 + 自定义输入、支付方式选择、到账与手续费预览。
 *
 * 契约来源：design/console-pages.md 余额与订单章节、src/features/billing/validation.ts。
 *
 * 边界：
 * - 金额校验完全交给同模块 validateRechargeAmount（全局/单笔上下限、日剩余、
 *   可用性、余额充值开关），本组件不重复实现边界规则。
 * - 预计到账是 amount × balance_recharge_multiplier 的展示值（USD）；
 *   应付金额用 calculatePaymentTotal 按支付币种精度向上取整，只作预估，
 *   最终金额以后端订单返回的 pay_amount 为准。
 * - 提交按钮在请求期间禁用，阻止重复下单；失败保留已输入金额与支付方式。
 * - 没有可用支付方式时只显示真实空态，不伪造选项。
 */

import { useState, type FormEvent } from 'react';

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
import type { BillingConfig, PaymentMethod } from './types';
import {
  calculatePaymentTotal,
  currencyFractionDigits,
  formatBillingMoney,
  validateRechargeAmount,
} from './validation';
import { formatFeeRate } from './billing-ui-format';

/** 旧前端 PaymentView 的预设金额档位，保留同一组数值。 */
const PRESET_AMOUNTS: readonly number[] = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

export interface RechargeSubmitInput {
  amount: number;
  method: PaymentMethod;
}

export interface RechargeFormProps {
  config: BillingConfig;
  /** 后端配置给出的支付方式；为空表示没有可用方式。 */
  methods: readonly PaymentMethod[];
  /** 创建订单进行中；期间禁止再次提交。 */
  submitting: boolean;
  /** 创建订单失败文案；失败时保留输入。 */
  submitError: string | null;
  onSubmit: (input: RechargeSubmitInput) => void;
  /** 下单结果不明时引导用户先查订单，避免重复创建。 */
  onCheckOrders: () => void;
}

/** 金额是否落在该支付方式与全局配置允许的区间内（0 = 不限）。 */
function presetFits(preset: number, method: PaymentMethod, config: BillingConfig): boolean {
  if (config.min > 0 && preset < config.min) return false;
  if (config.max > 0 && preset > config.max) return false;
  if (method.min > 0 && preset < method.min) return false;
  if (method.max > 0 && preset > method.max) return false;
  if (method.dailyLimit !== undefined && method.dailyLimit > 0 && preset > method.dailyLimit) {
    return false;
  }
  if (config.dailyLimit !== undefined && config.dailyLimit > 0 && preset > config.dailyLimit) {
    return false;
  }
  if (method.dailyRemaining !== null && preset > method.dailyRemaining) return false;
  return true;
}

/** 预估到账 USD：amount × multiplier，保留两位小数（与旧前端一致）。 */
function creditedUsd(amount: number, multiplier: number): number {
  const value = amount * multiplier;
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

/** 单笔限额说明；上下限都为 0 时不显示无意义的区间。 */
function methodLimitText(method: PaymentMethod): string {
  const parts: string[] = [];
  if (method.min > 0) {
    parts.push(`单笔最低 ${formatBillingMoney(method.min, method.currency)}`);
  }
  if (method.max > 0) {
    parts.push(`单笔最高 ${formatBillingMoney(method.max, method.currency)}`);
  }
  if (method.dailyRemaining !== null) {
    parts.push(`今日剩余 ${formatBillingMoney(method.dailyRemaining, method.currency)}`);
  }
  return parts.join(' · ');
}

/**
 * 充值卡。父组件只在配置成功且允许充值时渲染本组件，
 * 因此这里假定 config.enabled 已为 true，仍把禁用原因如实展示。
 */
export function RechargeForm({
  config,
  methods,
  submitting,
  submitError,
  onSubmit,
  onCheckOrders,
}: RechargeFormProps) {
  const usable = methods.filter((method) => method.available);
  const [methodId, setMethodId] = useState<string>(() => usable[0]?.id ?? '');
  const [amountText, setAmountText] = useState<string>(() => {
    const first = usable[0];
    if (first === undefined) return '';
    const preset = PRESET_AMOUNTS.find((value) => presetFits(value, first, config));
    return preset === undefined ? '' : String(preset);
  });
  const [formError, setFormError] = useState<string | null>(null);

  const candidate = usable.find((item) => item.id === methodId) ?? usable[0] ?? null;
  if (candidate === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>余额充值</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="当前没有可用的支付方式"
            description="后台尚未开放任何充值通道，请稍后再试或联系管理员。"
          />
        </CardContent>
      </Card>
    );
  }

  // 这里起 method 已确定非空：闭包内使用不会再退化为可选类型。
  const method: PaymentMethod = candidate;
  const digits = currencyFractionDigits(method.currency);
  // 输入框只给出区间提示：真实校验仍以 validateRechargeAmount 为准。
  const minAmount = Math.max(config.min, method.min);
  const presets = PRESET_AMOUNTS.filter((preset) => presetFits(preset, method, config));
  const validation = validateRechargeAmount(amountText, method, config);
  const amount = validation.amount;
  const payAmount =
    amount === null ? null : calculatePaymentTotal(amount, method.feeRate, method.currency);
  const credited = amount === null ? null : creditedUsd(amount, config.multiplier);
  const error = formError ?? (amountText.trim() === '' ? null : validation.error);

  function selectMethod(nextId: string) {
    setMethodId(nextId);
    // 切换方式后按新的单笔区间重新校验；已输入的金额保留，错误如实展示。
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const result = validateRechargeAmount(amountText, method, config);
    if (result.amount === null) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    onSubmit({ amount: result.amount, method });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>余额充值</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {config.balanceDisabled ? (
          <Alert
            variant="destructive"
            title="当前账号暂不支持余额充值"
            description="已有订单和余额仍然可以查看。"
          />
        ) : null}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <fieldset className="flex flex-col gap-3" disabled={submitting || config.balanceDisabled}>
            <legend className="text-sm font-medium text-foreground">充值金额</legend>
            {presets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => {
                  const selected = amountText.trim() === String(preset);
                  return (
                    <Button
                      key={preset}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={selected}
                      onClick={() => {
                        setAmountText(String(preset));
                        setFormError(null);
                      }}
                    >
                      {formatBillingMoney(preset, method.currency)}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="recharge-amount">自定义金额（{method.currency}）</Label>
              <Input
                id="recharge-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                autoComplete="off"
                min={minAmount > 0 ? minAmount : 0}
                step={1 / 10 ** digits}
                value={amountText}
                aria-invalid={error !== null}
                aria-describedby={error === null ? undefined : 'recharge-amount-error'}
                onChange={(event) => {
                  setAmountText(event.currentTarget.value);
                  setFormError(null);
                }}
              />
              {error !== null ? (
                <p id="recharge-amount-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recharge-method">支付方式</Label>
            <Select
              value={method.id}
              onValueChange={selectMethod}
              disabled={submitting || config.balanceDisabled}
            >
              <SelectTrigger id="recharge-method" aria-label="支付方式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {usable.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                    {item.feeRate > 0 ? `（手续费 ${formatFeeRate(item.feeRate)}%）` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {methodLimitText(method) !== '' ? (
              <p className="text-xs text-muted-foreground">{methodLimitText(method)}</p>
            ) : null}
          </div>

          <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">充值金额</dt>
              <dd className="tabular-nums">
                {amount === null ? '—' : formatBillingMoney(amount, method.currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">
                手续费率（{formatFeeRate(method.feeRate)}%）
              </dt>
              <dd className="tabular-nums">
                {payAmount === null || amount === null
                  ? '—'
                  : formatBillingMoney(payAmount - amount, method.currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">预计应付</dt>
              <dd className="text-base font-semibold tabular-nums">
                {payAmount === null ? '—' : formatBillingMoney(payAmount, method.currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">预计到账</dt>
              <dd className="tabular-nums">
                {credited === null ? '—' : formatBillingMoney(credited, 'USD')}
              </dd>
            </div>
            {config.multiplier !== 1 ? (
              <p className="text-xs text-muted-foreground">
                到账按 {method.currency} 1 : USD {config.multiplier} 折算。
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              手续费与应付金额为预估，最终以后端订单返回为准。
            </p>
          </dl>

          {submitError !== null ? (
            <Alert
              variant="destructive"
              title="创建订单未完成"
              description={`${submitError} 请先查看下方订单，确认没有已创建的订单后再重试。`}
              action={
                <Button type="button" variant="outline" size="sm" onClick={onCheckOrders}>
                  查看订单
                </Button>
              }
            />
          ) : null}

          {config.helpText !== null ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{config.helpText}</p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            disabled={config.balanceDisabled}
          >
            {payAmount === null
              ? '创建充值订单'
              : `创建充值订单 · ${formatBillingMoney(payAmount, method.currency)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
