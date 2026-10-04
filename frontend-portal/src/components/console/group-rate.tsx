import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ratioLabel } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/**
 * 倍率徽标的颜色：倍率越低越「便宜」的颜色，一眼分出分组档次。
 * 低于 ×0.2 绿、低于 ×0.5 蓝、低于 ×1 橙、正好 ×1（官方价）灰、高于官方价红。
 */
export function rateTone(rate: number): BadgeTone {
  if (rate < 0.2) return 'success';
  if (rate < 0.5) return 'info';
  if (rate < 1) return 'warning';
  if (rate === 1) return 'neutral';
  return 'danger';
}

/** 倍率徽标：×0.15、×1.0。交互检查找 data-group-rate */
export function RateBadge({ rate }: { rate: number }) {
  return (
    <Badge tone={rateTone(rate)} data-group-rate={rate}>
      {ratioLabel(rate)}
    </Badge>
  );
}

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
