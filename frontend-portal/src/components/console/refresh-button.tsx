'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { CONTROL_BUTTON } from './control-button';

/** 转圈时长：数据是占位的，转一下给出「已刷新」的反馈就够了 */
const REFRESH_MS = 600;

/**
 * 标题行右侧的刷新按钮：点击后图标转 600ms，期间按钮禁用，防止连点。
 * 高 40px、小圆角，和旁边的日期范围按钮、搜索框齐平。交互检查找 data-refresh。
 */
export function RefreshButton({ onRefresh }: { onRefresh?: () => void }) {
  const t = useTranslations('console');
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<number | null>(null);

  // 卸载时清掉定时器，避免离开页面后还去改状态
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const refresh = () => {
    setRefreshing(true);
    onRefresh?.();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setRefreshing(false);
    }, REFRESH_MS);
  };

  return (
    <Button
      variant="secondary"
      className={CONTROL_BUTTON}
      data-refresh
      disabled={refreshing}
      aria-busy={refreshing ? 'true' : undefined}
      onClick={refresh}
    >
      <RefreshCw aria-hidden className={refreshing ? 'animate-spin' : undefined} />
      {t('actions.refresh')}
    </Button>
  );
}
