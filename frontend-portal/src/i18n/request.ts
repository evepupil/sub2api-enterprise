import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { loadMessages } from '@/messages';

import { routing } from './routing';

/** 每个请求按地址里的语言加载对应文案，未知语言回落到中文。 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: loadMessages(locale) };
});
