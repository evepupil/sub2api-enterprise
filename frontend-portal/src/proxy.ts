import { type NextRequest, NextResponse } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { publicOriginFor } from '@/lib/server/session/origin';
import { loginRedirectFor } from '@/lib/session/guard';

/**
 * 控制台登录拦截：没有任何登录凭证 cookie 时，直接跳到登录页并带上回跳地址。
 *
 * 这里只看 cookie 在不在，不去后端验证：凭证过期或被作废的情况，由控制台打开后读当前用户时发现
 * （官网接口会清掉 cookie 并返回 401），再跳回登录页。
 * 跳转地址按用户浏览器看到的域名拼（经反向代理或隧道时看转发头），不能用服务端自己看到的内网地址。
 */
export function proxy(request: NextRequest) {
  if (hasSessionCookie(request.cookies)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const target = new URL(
    loginRedirectFor(pathname, search),
    publicOriginFor(request.url, request.headers),
  );
  const response = NextResponse.redirect(target, 307);
  response.headers.set('cache-control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/console/:path*', '/en/console/:path*'],
};
