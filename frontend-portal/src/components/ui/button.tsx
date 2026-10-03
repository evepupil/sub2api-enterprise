import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

import { buttonClass, type ButtonSize, type ButtonVariant } from './button-styles';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** 提交中：禁用按钮并在文字前显示转圈 */
  loading?: boolean;
};

/** 带样式的 <button>；需要跳转时用 <Link className={buttonClass(...)}>，不要套 Button。 */
export function Button({
  variant,
  size,
  block,
  loading = false,
  type = 'button',
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="animate-spin" /> : null}
      {children}
    </button>
  );
}
