import type { ReactNode } from 'react';

/**
 * 表单项：标签、输入控件、错误或提示。
 * 出错时错误文字的 id 是 `${htmlFor}-error`，输入框用 aria-describedby 指向它。
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  trailing,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string | null;
  hint?: ReactNode;
  /** 标签行右侧的内容，如「忘记密码？」 */
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
