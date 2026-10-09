import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ratioLabel } from '@/lib/catalog';

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

/**
 * 分组倍率徽标：×0.15、×1.0（2026-10-08 用户定：官网与控制台都直接写分组倍率，不写「几折」）。
 * 官网的价格页、模型页、首页与控制台共用。传了 base 且和 rate 不同（账号有专属倍率）时，
 * 先写划掉的分组原倍率、再写生效倍率，照原版 sub2api 选分组的写法。颜色按生效倍率。
 * 交互检查找 data-group-rate
 */
export function RateBadge({
  rate,
  base,
  className,
}: {
  rate: number;
  base?: number;
  className?: string;
}) {
  const custom = base !== undefined && base !== rate;
  return (
    <Badge tone={rateTone(rate)} data-group-rate={rate} className={className}>
      {custom ? (
        <del data-base-rate={base} className="opacity-60">
          {ratioLabel(base)}
        </del>
      ) : null}
      {ratioLabel(rate)}
    </Badge>
  );
}
