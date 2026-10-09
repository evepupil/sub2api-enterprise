'use client';

import { ArrowUpRight, TicketCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/console/button';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { Panel } from '@/components/console/panel';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatUsd } from '@/lib/console';
import { redeemCode } from '@/lib/console/live/billing-client';
import type { RedeemError, RedeemResult } from '@/lib/console/live/billing-types';
import { loginRedirectFor } from '@/lib/session/guard';

import { useTimers } from './billing-timers';

/** 「已到账」提示停留的时间 */
const RESULT_VISIBLE_MS = 4000;

/**
 * 兑换码：一整行的输入框加「兑换」按钮，交给后端兑换。成功后通知页面重新取余额卡与交易记录；
 * 余额码提示到账金额，并发数、订阅这类码只提示兑换成功。码区分大小写，原样提交（只去掉首尾空白）。
 */
export function BillingRedeemPanel({
  onRedeemed,
  buyUrl,
}: {
  onRedeemed: () => void;
  /** 卡网店铺地址：标题行右边「购买兑换码」在新窗口打开它；没有时不显示 */
  buyUrl?: string | null;
}) {
  const t = useTranslations('consoleBilling');
  const [value, setValue] = useState('');
  // 存错误类型而不是译好的文字，切换语言时提示跟着变
  const [error, setError] = useState<'required' | RedeemError | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const { schedule, cancel } = useTimers();

  const focusInput = () => document.getElementById('redeem-code')?.focus();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    // 重新提交时，上一次的成功提示立刻收起
    cancel('result');
    setResult(null);

    const code = value.trim();
    if (code === '') {
      setError('required');
      focusInput();
      return;
    }

    setError(null);
    setLoading(true);
    const outcome = await redeemCode(code);
    setLoading(false);
    if (outcome.kind === 'signed_out') {
      window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
      return;
    }
    if (outcome.kind === 'error') {
      setError(outcome.reason);
      focusInput();
      return;
    }
    setValue('');
    setResult(outcome.result);
    onRedeemed();
    schedule('result', RESULT_VISIBLE_MS, () => setResult(null));
  };

  const errorText =
    error === null
      ? null
      : error === 'required'
        ? t('errors.redeemRequired')
        : t(`errors.redeem.${error}`);

  return (
    // 输入框没有可见标签（面板标题已经说明），Field 里的读屏标签会带出 8px 上间距，
    // 这里把面板内容区的上内边距减掉同样的量
    <Panel
      id="redeem"
      title={
        <span className="flex items-center gap-2">
          <TicketCheck aria-hidden className="size-4 text-muted-foreground" />
          {t('redeem.title')}
        </span>
      }
      actions={
        buyUrl ? (
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-redeem-buy
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('redeem.buy')}
            <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        ) : null
      }
      bodyClassName="pt-3"
    >
      <form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <Field
          label={<span className="sr-only">{t('redeem.title')}</span>}
          htmlFor="redeem-code"
          error={errorText}
        >
          <div className="flex gap-2">
            <Input
              id="redeem-code"
              data-redeem-input
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={t('redeem.placeholder')}
              aria-label={t('redeem.title')}
              aria-invalid={errorText ? true : undefined}
              aria-describedby={errorText ? 'redeem-code-error' : undefined}
              value={value}
              readOnly={loading}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              className="min-w-0 flex-1 font-mono"
            />
            <Button type="submit" data-redeem-submit loading={loading} className={CONTROL_BUTTON}>
              {t('redeem.submit')}
            </Button>
          </div>
          {result ? (
            <p role="status" data-redeem-result className="text-sm text-success">
              {result.type === 'balance'
                ? t('redeem.credited', { amount: formatUsd(result.value) })
                : t('redeem.done')}
            </p>
          ) : null}
        </Field>
      </form>
    </Panel>
  );
}
