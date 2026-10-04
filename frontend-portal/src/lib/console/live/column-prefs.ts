'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * 表格的「列设置」：存在这台浏览器里（和模型收藏一样，换设备不同步）。
 * 存的是每一列显示与否：以后加了新列，没存过它的人按默认值走；锁定的列（如时间）总是显示。
 * 同一页面里保存后立刻生效，别的标签页改了也会同步过来。
 */

const CHANGE_EVENT = 'console-column-prefs-change';

export interface ColumnPrefsConfig<T extends string> {
  storageKey: string;
  /** 所有可选的列，按表格里的顺序 */
  columns: readonly T[];
  /** 没设置过时显示的列 */
  defaults: readonly T[];
  /** 不能取消的列 */
  locked: readonly T[];
}

/** 本地存储里的字符串 → 要显示的列（按表格顺序）；没存过、格式不对的部分按默认 */
export function parseColumnPrefs<T extends string>(
  raw: string | null,
  config: ColumnPrefsConfig<T>,
): T[] {
  let stored: Record<string, unknown> = {};
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        stored = value as Record<string, unknown>;
      }
    } catch {
      // 格式不对，当作没设置过
    }
  }
  return config.columns.filter((column) => {
    if (config.locked.includes(column)) return true;
    const saved = stored[column];
    return typeof saved === 'boolean' ? saved : config.defaults.includes(column);
  });
}

/** 要显示的列 → 存进本地存储的字符串（每一列都写明显示与否） */
export function serializeColumnPrefs<T extends string>(
  visible: readonly T[],
  config: ColumnPrefsConfig<T>,
): string {
  return JSON.stringify(
    Object.fromEntries(
      config.columns.map((column) => [
        column,
        config.locked.includes(column) || visible.includes(column),
      ]),
    ),
  );
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 浏览器禁用了本地存储时读写会抛错：读不到按默认，存不了就只在这次打开里生效不了，不让页面崩 */
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** config 要是模块里的常量（每次渲染同一个对象） */
export function useColumnPrefs<T extends string>(
  config: ColumnPrefsConfig<T>,
): [T[], (visible: readonly T[]) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readStorage(config.storageKey),
    () => null,
  );
  const visible = useMemo(() => parseColumnPrefs(raw, config), [raw, config]);
  const save = useCallback(
    (next: readonly T[]) => {
      try {
        window.localStorage.setItem(config.storageKey, serializeColumnPrefs(next, config));
      } catch {
        return;
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [config],
  );
  return [visible, save];
}
