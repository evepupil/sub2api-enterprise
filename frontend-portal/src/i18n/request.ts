import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { loadMessages } from '@/messages';

import { routing } from './routing';

/**
 * 每个请求按地址里的语言加载对应文案，未知语言回落到中文。
 * 时区固定北京时间：控制台的时间都按北京时间显示，服务端与浏览器不会因时区不同而渲染不一致。
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: loadMessages(locale), timeZone: 'Asia/Shanghai' };
});
