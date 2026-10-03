'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button-styles';
import { formatRatio, groupsFor, localize } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** 开关轨道与圆钮的样式：按状态取完整类名，不做字符串拼接。 */
const TRACK: Record<'on' | 'off', string> = {
  on: 'bg-primary',
  off: 'bg-border-strong',
};

const KNOB: Record<'on' | 'off', string> = {
  on: 'translate-x-[18px]',
  off: 'translate-x-0.5',
};

/** 面板里的一行：分组名 + 倍率 + 模型范围 + 可点的假开关。 */
function GroupRow(props: { groupId: string; on: boolean; onToggle: () => void }) {
  const locale = useLocale();
  const group = groupsFor('pro').find((g) => g.id === props.groupId);
  if (!group) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <Badge tone="outline">{localize(group.name, locale)}</Badge>
      <span className="font-mono text-xs text-foreground">{formatRatio(group.ratio, locale)}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {localize(group.scope, locale)}
      </span>
      {/* 开关只是行内的演示控件：按钮语义完整，键盘可达，焦点态走全局样式 */}
      <button
        type="button"
        role="switch"
        aria-checked={props.on}
        aria-label={localize(group.name, locale)}
        data-group-toggle={group.id}
        onClick={props.onToggle}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          TRACK[props.on ? 'on' : 'off'],
        )}
      >
        <span
          className={cn(
            'size-4 rounded-full bg-background shadow transition-transform',
            KNOB[props.on ? 'on' : 'off'],
          )}
        />
      </button>
    </div>
  );
}

/** C 分组卡：分组面板，开关默认前两行开、后两行关，点击切换。 */
export function FeaturesBentoGroupsCard() {
  const t = useTranslations('homeShowcase.features.groupsCard');

  // 开关状态只存在本地：id 是分组 id，默认取 groupsFor('pro') 的前两行开
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groupsFor('pro').map((group, i) => [group.id, i < 2])),
  );

  const toggle = (groupId: string) =>
    setState((current) => ({ ...current, [groupId]: !current[groupId] }));

  return (
    <div>
      <h3 className="text-xl font-medium tracking-tight text-foreground md:text-2xl">
        {t('title')}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground md:text-base">{t('desc')}</p>
      <div className="relative mt-8 h-[300px] md:h-[340px]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">{t('panelTitle')}</span>
            {/* 纯展示的假按钮：用 span，不给按钮语义 */}
            <span className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              <Plus />
              {t('add')}
            </span>
          </div>
          <div>
            {groupsFor('pro').map((group) => (
              <GroupRow
                key={group.id}
                groupId={group.id}
                on={state[group.id] ?? false}
                onToggle={() => toggle(group.id)}
              />
            ))}
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background"
        />
      </div>
    </div>
  );
}
