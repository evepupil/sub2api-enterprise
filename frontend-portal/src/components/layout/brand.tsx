import { Link } from '@/i18n/navigation';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

/** 品牌标志：黑色圆角色块加站名，点击回首页。 */
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2 text-sm font-medium text-foreground', className)}
    >
      <span aria-hidden className="block h-5 w-6 rounded-md bg-primary" />
      {SITE.name}
    </Link>
  );
}
