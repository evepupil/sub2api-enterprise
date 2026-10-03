import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/** 识别地址里的语言前缀；接口、静态资源和带扩展名的文件不经过这里。 */
export default createMiddleware(routing);

// 注意 \\. 是正则里的「点」，只写一个反斜杠会变成任意字符，导致除首页外的地址都不经过这里。
// /zh 开头的地址不经过这里：中文不带前缀的地址（如 /models）会被改写到 /zh/models，
// 实测 Next 16 会让改写后的请求再进一次中间件，它又把 /zh/models 跳回 /models，形成循环。
export const config = {
  matcher: '/((?!api|_next|_vercel|zh(?:/|$)|.*\\..*).*)',
};
