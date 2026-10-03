import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并类名：clsx 处理条件写法，twMerge 让后写的类盖掉前面冲突的类。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
