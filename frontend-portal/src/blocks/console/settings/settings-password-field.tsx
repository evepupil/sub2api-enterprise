'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/**
 * 密码输入框：输入框右端的眼睛按钮切换明文显示。
 * 受控值放在父组件；错误文字由 Field 渲染（id 为 `${id}-error`，带 role="alert"）。
 */
export function SettingsPasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoComplete: 'current-password' | 'new-password';
  readOnly?: boolean;
}) {
  const t = useTranslations('consoleSettings');
  const [shown, setShown] = useState(false);

  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 pr-10"
        />
        {/* 眼睛按钮浮在输入框右端，占 40px；输入框留出 pr-10 给它 */}
        <button
          type="button"
          data-password-toggle={id}
          aria-label={shown ? t('password.hide') : t('password.show')}
          aria-controls={id}
          onClick={() => setShown((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:text-foreground"
        >
          {shown ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      </div>
    </Field>
  );
}
