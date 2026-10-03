'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Panel } from '@/components/console/panel';
import { Switch } from '@/components/console/switch';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CURRENT_USER } from '@/lib/console';

import { AmountInput } from './billing-amount-input';
import {
  ALERT_THRESHOLD_LIMITS,
  formatUsdWhole,
  isHttpsUrl,
  isThresholdValid,
  parseAmount,
  type AlertSettings,
} from './billing-rules';
import { useTimers } from './billing-timers';

/** 保存的加载时长 */
const SAVE_DELAY_MS = 800;
/** 「已保存」停留的时间 */
const SAVED_VISIBLE_MS = 2000;

/** 编辑中的草稿：阈值保留输入框里的原始文字，保存时才解析成数字 */
interface Draft {
  threshold: string;
  email: boolean;
  webhook: boolean;
  url: string;
}

function toDraft(settings: AlertSettings): Draft {
  return {
    threshold: String(settings.thresholdUsd),
    email: settings.email,
    webhook: settings.webhook,
    url: settings.webhookUrl,
  };
}

/**
 * 余额提醒面板：阈值、邮件、Webhook 三项设置，改动后点保存才生效。
 * 保存成功后页面拿到新设置，账单顶部的低余额提醒条立刻按新阈值判断。
 */
export function BillingAlertPanel({
  settings,
  onSave,
}: {
  settings: AlertSettings;
  onSave: (next: AlertSettings) => void;
}) {
  const t = useTranslations('consoleBilling');
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState({ threshold: false, url: false });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { schedule } = useTimers();

  const dirty =
    parseAmount(draft.threshold) !== settings.thresholdUsd ||
    draft.email !== settings.email ||
    draft.webhook !== settings.webhook ||
    draft.url.trim() !== settings.webhookUrl;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !dirty) return;

    const threshold = parseAmount(draft.threshold);
    const thresholdOk = isThresholdValid(threshold);
    // 地址只在开启 Webhook 时才必填
    const urlOk = !draft.webhook || isHttpsUrl(draft.url);
    if (!thresholdOk || !urlOk) {
      // 所有出错的字段同时标红，焦点落在第一个（顺序：阈值 → 地址）
      setErrors({ threshold: !thresholdOk, url: !urlOk });
      document.getElementById(thresholdOk ? 'alert-webhook-url' : 'alert-threshold')?.focus();
      return;
    }

    setErrors({ threshold: false, url: false });
    setJustSaved(false);
    setSaving(true);
    const next: AlertSettings = {
      thresholdUsd: threshold,
      email: draft.email,
      webhook: draft.webhook,
      webhookUrl: draft.url.trim(),
    };
    schedule('save', SAVE_DELAY_MS, () => {
      onSave(next);
      setSaving(false);
      setJustSaved(true);
      schedule('saved', SAVED_VISIBLE_MS, () => setJustSaved(false));
    });
  };

  const thresholdError = errors.threshold
    ? t('errors.amountRange', {
        min: formatUsdWhole(ALERT_THRESHOLD_LIMITS.min),
        max: formatUsdWhole(ALERT_THRESHOLD_LIMITS.max),
      })
    : null;

  return (
    <Panel id="balance-alert" title={t('alert.title')}>
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        <Field label={t('alert.threshold')} htmlFor="alert-threshold" error={thresholdError}>
          <AmountInput
            id="alert-threshold"
            max={ALERT_THRESHOLD_LIMITS.max}
            value={draft.threshold}
            aria-invalid={errors.threshold ? true : undefined}
            aria-describedby={errors.threshold ? 'alert-threshold-error' : undefined}
            onChange={(event) => {
              setDraft((current) => ({ ...current, threshold: event.target.value }));
              setErrors((current) => ({ ...current, threshold: false }));
            }}
          />
        </Field>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t('alert.email')}</p>
            <p className="truncate text-xs text-subtle-foreground">{CURRENT_USER.email}</p>
          </div>
          <Switch
            name="alert-email"
            ariaLabel={t('alert.email')}
            checked={draft.email}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, email: checked }))}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">{t('alert.webhook')}</p>
            <Switch
              name="alert-webhook"
              ariaLabel={t('alert.webhook')}
              checked={draft.webhook}
              onCheckedChange={(checked) => {
                setDraft((current) => ({ ...current, webhook: checked }));
                // 关掉 Webhook 后，地址上的错误提示跟着消失
                if (!checked) setErrors((current) => ({ ...current, url: false }));
              }}
            />
          </div>
          {draft.webhook ? (
            <Field
              label={t('alert.webhookUrl')}
              htmlFor="alert-webhook-url"
              error={errors.url ? t('errors.webhookUrl') : null}
            >
              <Input
                id="alert-webhook-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://"
                value={draft.url}
                aria-invalid={errors.url ? true : undefined}
                aria-describedby={errors.url ? 'alert-webhook-url-error' : undefined}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, url: event.target.value }));
                  setErrors((current) => ({ ...current, url: false }));
                }}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3">
          {/* 保存成功后短暂提示；一旦又改了设置，提示立刻收起 */}
          {justSaved && !dirty ? (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
              <Check aria-hidden className="size-4" />
              {t('alert.saved')}
            </span>
          ) : null}
          <Button type="submit" data-alert-save disabled={!dirty} loading={saving}>
            {t('alert.save')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
