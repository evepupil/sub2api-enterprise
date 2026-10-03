'use client';

import { QrCode } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Dialog } from '@/components/console/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { ENABLE_TWO_FACTOR_MS, TWO_FACTOR_CODE_LENGTH, TWO_FACTOR_SECRET } from './settings-config';
import { useSchedule } from './settings-timers';
import { isValidTwoFactorCode, sanitizeTwoFactorCode } from './settings-validation';

const FORM_ID = 'two-factor-form';
const CODE_FIELD_ID = 'two-factor-code';

/**
 * 开启两步验证的弹窗：左边二维码占位图，右边可手动输入的密钥，下面填验证器 App 里的 6 位动态码。
 * 父级只在需要时渲染它，所以每次打开都从空白验证码开始。
 * 确认后转 0.8 秒圈再通知父级「已开启」；确认中不允许关闭弹窗。
 */
export function SettingsTwoFactorSetupDialog({
  onClose,
  onEnabled,
}: {
  onClose: () => void;
  onEnabled: () => void;
}) {
  const t = useTranslations('consoleSettings');
  const tc = useTranslations('console');
  const schedule = useSchedule();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirming) return;
    if (!isValidTwoFactorCode(code)) {
      setInvalid(true);
      document.getElementById(CODE_FIELD_ID)?.focus();
      return;
    }
    setConfirming(true);
    schedule(onEnabled, ENABLE_TWO_FACTOR_MS);
  };

  return (
    <Dialog
      id="two-factor-setup"
      open
      onOpenChange={(open) => {
        if (!open && !confirming) onClose();
      }}
      title={t('twoFactor.setup.title')}
      footer={
        <>
          <Button variant="secondary" disabled={confirming} onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={confirming} data-two-factor-confirm>
            {t('twoFactor.setup.confirm')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {/* 二维码占位：接后端后换成服务端生成的图 */}
          <div className="flex size-36 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
            <QrCode aria-hidden strokeWidth={1.25} className="size-24 text-foreground" />
          </div>
          <div className="w-full min-w-0 flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">{t('twoFactor.setup.manualKey')}</p>
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface py-1 pl-3 pr-1">
              <code
                data-two-factor-secret
                className="min-w-0 flex-1 truncate font-mono text-sm text-foreground"
              >
                {TWO_FACTOR_SECRET}
              </code>
              <CopyButton
                name="two-factor-secret"
                value={TWO_FACTOR_SECRET.replaceAll(' ', '')}
                label={t('twoFactor.setup.copyKey')}
              />
            </div>
          </div>
        </div>

        <Field
          label={t('twoFactor.setup.code')}
          htmlFor={CODE_FIELD_ID}
          error={
            invalid
              ? t('twoFactor.setup.errors.codeInvalid', { digits: TWO_FACTOR_CODE_LENGTH })
              : null
          }
        >
          <Input
            id={CODE_FIELD_ID}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={TWO_FACTOR_CODE_LENGTH}
            readOnly={confirming}
            value={code}
            onChange={(event) => {
              setCode(sanitizeTwoFactorCode(event.target.value));
              setInvalid(false);
            }}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? `${CODE_FIELD_ID}-error` : undefined}
            className="font-mono tracking-widest"
          />
        </Field>
      </form>
    </Dialog>
  );
}
