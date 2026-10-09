'use client';

import { useTranslations } from 'next-intl';

import { RateBadge } from '@/components/catalog/rate-badge';
import { Badge } from '@/components/ui/badge';
import type { KeyGroupOption } from '@/lib/console/live/keys-types';

/**
 * 密钥表单分组下拉里的一项，照原版 sub2api 选分组的样子（2026-10-08 用户要求）：
 * 左边分组名（加粗）和后台写的分组描述（保留换行，最多三行，悬停看全文；没写不显示）；
 * 右边倍率（账号有专属倍率时先写划掉的原倍率），分组开了高峰加价时下面再写高峰时段。
 * 交互检查：data-group-option={分组编号}、data-group-description、data-group-peak。
 */
export function KeyGroupOptionContent({ group }: { group: KeyGroupOption }) {
  const t = useTranslations('consoleKeys');
  const peak = group.peak
    ? t('form.groupPeak', {
        window: `${group.peak.start}–${group.peak.end}`,
        multiplier: group.peak.multiplier,
      })
    : null;
  return (
    <span
      data-group-option={group.id}
      title={group.description || undefined}
      className="flex min-w-0 flex-1 items-start justify-between gap-3 py-0.5"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{group.name}</span>
        {group.description ? (
          <span
            data-group-description
            className="mt-1 line-clamp-3 whitespace-pre-line break-words text-xs leading-5 text-muted-foreground"
          >
            {group.description}
          </span>
        ) : null}
        {/* 窄屏时高峰标签放描述下面，不和倍率挤在右边把描述压成一条 */}
        {peak ? (
          <Badge tone="warning" data-group-peak="narrow" className="mt-1.5 sm:hidden">
            {peak}
          </Badge>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <RateBadge rate={group.rate} base={group.baseRate} className="self-end" />
        {peak ? (
          <Badge tone="warning" data-group-peak="wide" className="hidden self-end sm:inline-flex">
            {peak}
          </Badge>
        ) : null}
      </span>
    </span>
  );
}

export default KeyGroupOptionContent;
