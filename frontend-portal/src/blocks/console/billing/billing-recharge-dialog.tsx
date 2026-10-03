'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Dialog } from '@/components/console/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import {
  formatPercent,
  formatUsd,
  RECHARGE_BONUS_TIERS,
  RECHARGE_LIMITS,
  RECHARGE_PRESETS,
  rechargeBonus,
  type PaymentMethod,
} from '@/lib/console';
import { cn } from '@/lib/utils';

import { AmountInput } from './billing-amount-input';
import { BillingPayMethods } from './billing-pay-methods';
import { formatUsdWhole, parseRechargeAmount, roundCents } from './billing-rules';
import { useTimers } from './billing-timers';

/** 去支付的加载时长，结束后到账 */
const PAY_DELAY_MS = 1200;

/** 默认选中第二档（档位表至少有两档时），没有就退到第一档 */
const DEFAULT_PRESET: number | null = RECHARGE_PRESETS[1] ?? RECHARGE_PRESETS[0] ?? null;
const DEFAULT_METHOD: PaymentMethod = 'alipay';

/** 档位按钮：选中与未选中的样式，按状态映射，不拼接类名 */
const PRESET = {
  on: 'border-foreground bg-muted',
  off: 'border-border bg-card hover:bg-muted',
} as const;

const FORM_ID = 'recharge-form';

/** 赠送档位按金额从低到高排好，拼成「满 US$200 赠送 5%，满 US$500 赠送 10%」 */
const ASCENDING_TIERS = [...RECHARGE_BONUS_TIERS].sort((a, b) => a.minUsd - b.minUsd);

/**
 * 充值弹窗：选档位或填自定义金额、选支付方式，点「去支付」加载 1.2 秒后到账。
 * 只在打开时才挂载表单，所以每次打开都是一份全新的选择，不需要手动重置。
 */
export function BillingRechargeDialog({
  open,
  onOpenChange,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 支付成功：到账金额（不含赠送）和所选支付方式 */
  onPaid: (amountUsd: number, method: PaymentMethod) => void;
}) {
  return open ? <RechargeDialogBody onOpenChange={onOpenChange} onPaid={onPaid} /> : null;
}

function RechargeDialogBody({
  onOpenChange,
  onPaid,
}: {
  onOpenChange: (open: boolean) => void;
  onPaid: (amountUsd: number, method: PaymentMethod) => void;
}) {
  const t = useTranslations('consoleBilling');
  const tc = useTranslations('console');
  const [preset, setPreset] = useState<number | null>(DEFAULT_PRESET);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(DEFAULT_METHOD);
  // 点「去支付」时金额不合法才标红，输入过程中不打扰
  const [invalid, setInvalid] = useState(false);
  const [paying, setPaying] = useState(false);
  const { schedule } = useTimers();

  /** 要充的金额：选了档位用档位，否则用自定义金额；没填或超出限额为 null */
  const amount = preset ?? parseRechargeAmount(custom);
  const bonus = amount === null ? 0 : rechargeBonus(amount);

  const choosePreset = (value: number) => {
    setPreset(value);
    setCustom('');
    setInvalid(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (paying) return;
    if (amount === null) {
      setInvalid(true);
      document.getElementById('recharge-custom')?.focus();
      return;
    }
    setPaying(true);
    schedule('pay', PAY_DELAY_MS, () => {
      onPaid(amount, method);
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      id="recharge"
      open
      // 支付进行中不允许关掉弹窗，避免钱已经出去了界面却没有结果
      onOpenChange={(next) => {
        if (!paying) onOpenChange(next);
      }}
      title={t('recharge.title')}
      footer={
        <>
          <Button variant="secondary" disabled={paying} onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} data-recharge-submit loading={paying}>
            {t('recharge.submit')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <div
            role="group"
            aria-label={t('recharge.amounts')}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {RECHARGE_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                data-recharge-amount={value}
                aria-pressed={preset === value}
                onClick={() => choosePreset(value)}
                className={cn(
                  'h-11 rounded-md border px-3 text-sm font-medium tabular-nums text-foreground transition-colors',
                  preset === value ? PRESET.on : PRESET.off,
                )}
              >
                {formatUsdWhole(value)}
              </button>
            ))}
          </div>
          <Field
            label={t('recharge.custom')}
            htmlFor="recharge-custom"
            error={
              invalid
                ? t('errors.amountRange', {
                    min: formatUsdWhole(RECHARGE_LIMITS.min),
                    max: formatUsdWhole(RECHARGE_LIMITS.max),
                  })
                : null
            }
          >
            <AmountInput
              id="recharge-custom"
              max={RECHARGE_LIMITS.max}
              value={custom}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? 'recharge-custom-error' : undefined}
              onChange={(event) => {
                setCustom(event.target.value);
                // 开始填自定义金额，就不再沿用档位
                setPreset(null);
                setInvalid(false);
              }}
            />
          </Field>
        </div>

        <div className="space-y-1">
          {bonus > 0 ? (
            <p className="text-sm text-success">
              {t('recharge.bonus', { amount: formatUsd(bonus) })}
            </p>
          ) : null}
          <p className="text-xs text-subtle-foreground">
            {ASCENDING_TIERS.map((tier) =>
              t('recharge.tier', {
                min: formatUsdWhole(tier.minUsd),
                rate: formatPercent(tier.rate, 0),
              }),
            ).join(t('recharge.tierJoin'))}
          </p>
        </div>

        <BillingPayMethods value={method} onChange={setMethod} />

        {amount !== null ? (
          <p className="border-t border-border pt-4 text-base font-semibold tabular-nums text-foreground">
            {t('recharge.total', { amount: formatUsd(roundCents(amount + bonus)) })}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
