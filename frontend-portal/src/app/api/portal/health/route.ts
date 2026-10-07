/**
 * 健康检查：容器和反向代理用。只看官网进程在不在，不连后台——后台暂时连不上时官网页面照样能打开
 * （模型与价格那几块显示为空），不该因此被判成不健康而反复重启。
 */
export function GET() {
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
