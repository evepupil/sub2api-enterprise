import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { type AppLocale, routing } from './routing';

/** 页面和布局统一的参数类型 */
export interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/**
 * 每个页面开头调用：校验地址里的语言并登记给本次渲染（页面才能静态生成），
 * 返回类型安全的语言值。未知语言直接 404。
 */
export async function initPage(params: LocaleParams['params']): Promise<AppLocale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
