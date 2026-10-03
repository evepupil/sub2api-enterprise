import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'inverse' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** 官网用胶囊按钮（pill）；控制台统一 6px 小圆角（rounded），走 `@/components/console/button` */
export type ButtonShape = 'pill' | 'rounded';

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  block?: boolean;
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

const SHAPES: Record<ButtonShape, string> = {
  pill: 'rounded-full',
  // 和输入框、下拉框、菜单项同一个圆角
  rounded: 'rounded-md',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-[38px] px-4 text-sm',
  lg: 'h-11 px-6 text-sm md:text-base',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-button hover:bg-primary/90 active:bg-primary/80',
  secondary:
    'border border-border bg-card text-foreground shadow-card hover:bg-muted active:bg-muted/80',
  ghost: 'text-foreground hover:bg-muted active:bg-muted/80',
  link: 'h-auto rounded-none px-0 text-foreground underline-offset-4 hover:underline',
  inverse: 'bg-white text-neutral-900 shadow-pill hover:bg-neutral-100 active:bg-neutral-200',
  // 删除等危险操作；暗色下底色变浅，文字跟着换成主色前景，保证对比度
  danger: 'bg-danger text-primary-foreground hover:bg-danger/90 active:bg-danger/80',
};

/**
 * 按钮样式拼接：站内跳转的 <Link> 和 <button> 共用同一套外观。
 * 拼接顺序是 基础 → 形状 → 尺寸 → 变体 → 整宽 → 自定义，后写的盖掉前面冲突的类
 * （link 的 px-0、rounded-none 靠它盖掉尺寸的内边距和形状的圆角）。
 */
export function buttonClass(opts: ButtonClassOptions = {}): string {
  const { variant = 'primary', size = 'md', shape = 'pill', block = false, className } = opts;
  return cn(BASE, SHAPES[shape], SIZES[size], VARIANTS[variant], block && 'w-full', className);
}
