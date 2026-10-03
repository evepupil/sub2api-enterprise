import { Button as SiteButton, type ButtonProps } from '@/components/ui/button';
import {
  buttonClass as siteButtonClass,
  type ButtonClassOptions,
} from '@/components/ui/button-styles';

/**
 * 控制台的按钮：和官网同一套颜色与尺寸，圆角统一成 6px（和输入框、下拉框、菜单项一致）；官网保持胶囊按钮。
 * 控制台代码一律从这里取按钮，直接引用 `@/components/ui/button` 会被代码检查拦下（见 eslint.config.mjs）。
 */
export function Button(props: Omit<ButtonProps, 'shape'>) {
  return <SiteButton {...props} shape="rounded" />;
}

/** 链接或下拉触发器要长得像按钮时用 */
export function buttonClass(opts: Omit<ButtonClassOptions, 'shape'> = {}): string {
  return siteButtonClass({ ...opts, shape: 'rounded' });
}
