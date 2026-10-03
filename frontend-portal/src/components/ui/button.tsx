import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

import {
  buttonClass,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from './button-styles';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 默认胶囊；控制台的按钮走 `@/components/console/button`，固定为小圆角 */
  shape?: ButtonShape;
  block?: boolean;
  /** 提交中：禁用按钮并在文字前显示转圈 */
  loading?: boolean;
};

/** 带样式的 <button>；需要跳转时用 <Link className={buttonClass(...)}>，不要套 Button。 */
export function Button({
  variant,
  size,
  shape,
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
      className={buttonClass({ variant, size, shape, block, className })}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="animate-spin" /> : null}
      {children}
    </button>
  );
}
