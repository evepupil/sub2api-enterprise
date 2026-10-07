import { BrandMark } from '@/components/layout/brand-mark';
import { Link } from '@/i18n/navigation';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

/** 品牌标志：品牌图形加站名，点击回首页。 */
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2 text-sm font-medium text-foreground', className)}
    >
      <BrandMark className="size-5" />
      {SITE.name}
    </Link>
  );
}
