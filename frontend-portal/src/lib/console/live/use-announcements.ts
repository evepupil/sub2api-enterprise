'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ConsoleAnnouncement } from './announcement-types';
import { fetchAnnouncements, sendAnnouncementsRead } from './announcements-client';
import { unreadCount, withRead } from './announcements-view';
import { useLoadable } from './loadable';

/** 自动刷新间隔：和原版 sub2api 一样 20 分钟 */
const REFRESH_MS = 20 * 60 * 1000;

export interface AnnouncementsState {
  /** 读到过就一直是 ready（之后自动刷新失败也照常显示上次的）；第一次还没回来是 loading，第一次就失败是 error */
  status: 'loading' | 'error' | 'ready';
  items: readonly ConsoleAnnouncement[];
  unread: number;
  /** 重新读（出错时的「重试」） */
  reload: () => void;
  /** 标为已读：先在界面上标上，再告诉后台；失败不提示 */
  markRead: (ids: readonly number[]) => void;
}

const NO_ITEMS: readonly ConsoleAnnouncement[] = [];

/**
 * 控制台铃铛的公告：进控制台读一次，之后每 20 分钟再读一次。在控制台外壳里调一次，
 * 侧栏、手机抽屉和手机顶栏的铃铛共用这一份。登录失效时整页跳登录页。
 */
export function useAnnouncements(): AnnouncementsState {
  const [reloadKey, setReloadKey] = useState(0);
  const loaded = useLoadable(String(reloadKey), fetchAnnouncements);
  const [readIds, setReadIds] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    const timer = window.setInterval(() => setReloadKey((key) => key + 1), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo(
    () => (loaded.data ? withRead(loaded.data, readIds) : NO_ITEMS),
    [loaded.data, readIds],
  );

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const markRead = useCallback((ids: readonly number[]) => {
    if (ids.length === 0) return;
    setReadIds((previous) => new Set([...previous, ...ids]));
    void sendAnnouncementsRead(ids);
  }, []);

  const status = loaded.data !== null ? 'ready' : loaded.error !== null ? 'error' : 'loading';
  return { status, items, unread: unreadCount(items), reload, markRead };
}
