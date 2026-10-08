import { RateBadge } from '@/components/catalog/rate-badge';
import { cn } from '@/lib/utils';

/** 分组名 + 倍率徽标（名字太长时截断，悬停看全名）。模型页、日志页共用 */
export function GroupWithRate({
  name,
  rate,
  className,
}: {
  name: string;
  rate: number;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2 whitespace-nowrap', className)}>
      <span className="max-w-40 truncate" title={name}>
        {name}
      </span>
      <RateBadge rate={rate} />
    </div>
  );
}
