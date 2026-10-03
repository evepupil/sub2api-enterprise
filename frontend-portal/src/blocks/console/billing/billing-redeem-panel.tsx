'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { CONTROL_BUTTON } from '@/components/console/control-button';
import { Panel } from '@/components/console/panel';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatUsd } from '@/lib/console';

import { checkRedeemCode, REDEEM_AMOUNT_USD } from './billing-rules';
import { useTimers } from './billing-timers';

/** 兑换请求的加载时长，结束后到账 */
const REDEEM_DELAY_MS = 1000;
/** 「已到账」提示停留的时间 */
const RESULT_VISIBLE_MS = 3000;

/**
 * 兑换码面板：输入兑换码，校验通过后加载 1 秒，成功则通知页面记一笔入账流水。
 * 输入、校验、加载和成功提示都是面板内部的状态，页面只关心「兑换成功了哪个码」。
 */
export function BillingRedeemPanel({ onRedeemed }: { onRedeemed: (code: string) => void }) {
  const t = useTranslations('consoleBilling');
  const [value, setValue] = useState('');
  // 存错误类型而不是译好的文字，切换语言时提示跟着变
  const [error, setError] = useState<'required' | 'format' | null>(null);
  const [loading, setLoading] = useState(false);
  const [credited, setCredited] = useState(false);
  const { schedule, cancel } = useTimers();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    // 重新提交时，上一次的成功提示立刻收起
    cancel('result');
    setCredited(false);

    const check = checkRedeemCode(value);
    if (!check.ok) {
      setError(check.reason);
      document.getElementById('redeem-code')?.focus();
      return;
    }

    setError(null);
    setLoading(true);
    schedule('redeem', REDEEM_DELAY_MS, () => {
      onRedeemed(check.code);
      setValue('');
      setLoading(false);
      setCredited(true);
      schedule('result', RESULT_VISIBLE_MS, () => setCredited(false));
    });
  };

  const errorText =
    error === null
      ? null
      : error === 'required'
        ? t('errors.redeemRequired')
        : t('errors.redeemFormat');

  return (
    // 输入框没有可见标签（面板标题已经说明），Field 里的读屏标签会带出 8px 上间距，
    // 这里把面板内容区的上内边距减掉同样的量
    <Panel id="redeem" title={t('redeem.title')} bodyClassName="pt-3">
      <form noValidate onSubmit={handleSubmit}>
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
              autoCapitalize="characters"
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
              className="min-w-0 flex-1 font-mono uppercase placeholder:normal-case"
            />
            <Button type="submit" data-redeem-submit loading={loading} className={CONTROL_BUTTON}>
              {t('redeem.submit')}
            </Button>
          </div>
          {credited ? (
            <p role="status" data-redeem-result className="text-sm text-success">
              {t('redeem.success', { amount: formatUsd(REDEEM_AMOUNT_USD) })}
            </p>
          ) : null}
        </Field>
      </form>
    </Panel>
  );
}
