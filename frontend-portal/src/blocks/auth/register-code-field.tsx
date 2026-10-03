'use client';

import { Check, LoaderCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { StatusLine } from './use-register-messages';

const TONE: Record<StatusLine['tone'], string> = {
  muted: 'text-subtle-foreground',
  success: 'text-success',
  danger: 'text-danger',
};

/**
 * 邀请码、优惠码、返利码共用的输入框：标签后可带「选填」，输入框下面一行显示实时校验状态
 * （校验中 / 有效 / 无效）。字段本身的错误（如「请输入邀请码」）优先于校验状态显示。
 */
export function RegisterCodeField({
  id,
  label,
  optional,
  value,
  onChange,
  status,
  error,
  dataAttribute,
}: {
  id: string;
  label: string;
  optional: boolean;
  value: string;
  onChange: (value: string) => void;
  status: StatusLine | null;
  error?: string;
  dataAttribute: 'data-register-invite' | 'data-register-promo' | 'data-register-aff';
}) {
  const t = useTranslations('auth');
  const describedBy = error ? `${id}-error` : status ? `${id}-status` : undefined;

  return (
    <Field
      label={
        <>
          {label}
          {optional ? (
            <span className="ml-1.5 text-xs font-normal text-subtle-foreground">
              {t('fields.optional')}
            </span>
          ) : null}
        </>
      }
      htmlFor={id}
      error={error}
    >
      <Input
        id={id}
        name={id}
        {...{ [dataAttribute]: true }}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error || status?.tone === 'danger' ? true : undefined}
        aria-describedby={describedBy}
        className="min-w-0"
      />
      {!error && status ? (
        <p
          id={`${id}-status`}
          data-code-status={status.tone}
          className={cn('flex items-center gap-1.5 text-xs', TONE[status.tone])}
        >
          {status.tone === 'muted' ? (
            <LoaderCircle
              aria-hidden
              className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            />
          ) : status.tone === 'success' ? (
            <Check aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <X aria-hidden className="size-3.5 shrink-0" />
          )}
          <span>{status.text}</span>
        </p>
      ) : null}
    </Field>
  );
}
