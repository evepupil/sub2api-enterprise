'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * 模型收藏：后端没有收藏功能，存在这台浏览器里（用户确认，换设备不同步）。
 * 读写本地存储，同一页面里改了立刻生效，别的标签页改了也会同步过来。
 */

const STORAGE_KEY = 'console-model-favorites';
const CHANGE_EVENT = 'console-model-favorites-change';

/** 本地存储里的字符串 → 收藏的模型名列表；格式不对时当作没有收藏 */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/** 收藏或取消收藏一个模型 */
export function toggleFavorite(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const readSnapshot = (): string | null => window.localStorage.getItem(STORAGE_KEY);
const serverSnapshot = (): string | null => null;

export function useFavoriteModels(): [readonly string[], (id: string) => void] {
  const raw = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);
  const favorites = useMemo(() => parseFavorites(raw), [raw]);
  const toggle = useCallback((id: string) => {
    const next = toggleFavorite(parseFavorites(readSnapshot()), id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [favorites, toggle];
}
