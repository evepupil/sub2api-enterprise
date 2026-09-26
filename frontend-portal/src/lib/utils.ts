import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并条件类名并消解 Tailwind 冲突。
 * 纯函数，无客户端指令，服务端组件同样可用。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
