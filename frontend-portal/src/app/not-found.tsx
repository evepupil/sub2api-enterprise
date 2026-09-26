import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-dialog flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="text-table font-medium text-muted-foreground">404</p>
      <h1 className="text-page">页面不存在</h1>
      <p className="text-base text-muted-foreground">你访问的地址没有对应内容，或内容尚未开放。</p>
      <Link
        href="/"
        className="text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
      >
        返回首页
      </Link>
    </main>
  );
}
