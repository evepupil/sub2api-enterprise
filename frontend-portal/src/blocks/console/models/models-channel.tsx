import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ratioLabel } from '@/lib/catalog';
import type { RowChannel } from '@/lib/console/live/models-view';

/**
 * 倍率徽标的颜色：倍率越低越「便宜」的颜色，一眼分出通道档次。
 * 低于 ×0.2 绿、低于 ×0.5 蓝、低于 ×1 橙、正好 ×1（官方价）灰、高于官方价红。
 */
function rateTone(rate: number): BadgeTone {
  if (rate < 0.2) return 'success';
  if (rate < 0.5) return 'info';
  if (rate < 1) return 'warning';
  if (rate === 1) return 'neutral';
  return 'danger';
}

/** 通道列：通道名 + 倍率徽标（名字太长时截断，悬停看全名） */
export function ChannelCell({ channel }: { channel: RowChannel }) {
  return (
    <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <span className="max-w-40 truncate text-foreground" title={channel.name}>
        {channel.name}
      </span>
      <Badge tone={rateTone(channel.rate)} data-channel-rate={channel.rate}>
        {ratioLabel(channel.rate)}
      </Badge>
    </div>
  );
}
