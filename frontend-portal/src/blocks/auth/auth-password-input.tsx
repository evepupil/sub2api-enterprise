'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

/**
 * 登录、注册、重置密码共用的密码输入框：受控值放在父组件，眼睛按钮只切换明文显示；标签默认「密码」。
 * 错误文字由 Field 渲染（id = `${htmlFor}-error`、role="alert"），输入框用 aria-describedby 指向它。
 */
export function AuthPasswordInput({
  id,
  name,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  autoFocus,
  dataAttribute,
  trailing,
}: {
  id: string;
  name: string;
  /** 不传时是「密码」 */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  /** 输入框上要挂的 data-* 检查钩子，如 data-login-password / data-register-password */
  dataAttribute?:
    'data-login-password' | 'data-register-password' | 'data-reset-password' | 'data-reset-confirm';
  /** 标签行右侧的内容，登录页放「忘记密码？」 */
  trailing?: ReactNode;
}) {
  const t = useTranslations('auth');
  const [show, setShow] = useState(false);
  // 只有出错时才把描述指向错误文字，避免 aria-describedby 指向不存在的节点
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <Field
      label={label ?? t('fields.password')}
      htmlFor={id}
      error={error}
      hint={error ? undefined : hint}
      trailing={trailing}
    >
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          data-password-input={id}
          {...(dataAttribute ? { [dataAttribute]: true } : {})}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 pr-10"
        />
        {/* 眼睛按钮浮在输入框右端，占 40px；输入框 pr-10 给它让位 */}
        <button
          type="button"
          data-password-toggle
          aria-label={show ? t('fields.hidePassword') : t('fields.showPassword')}
          aria-controls={id}
          onClick={() => setShow((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:text-foreground"
        >
          {show ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </Field>
  );
}

export default AuthPasswordInput;
