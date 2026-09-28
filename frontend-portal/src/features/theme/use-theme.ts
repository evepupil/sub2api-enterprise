'use client';

import { useSyncExternalStore } from 'react';
import { themeStore } from './theme-store';

export function useTheme() {
  const snapshot = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  return { ...snapshot, setPreference: themeStore.setPreference };
}

/** Keeps system and cross-tab changes connected even on pages without a switcher. */
export function ThemeRuntime() {
  useTheme();
  return null;
}
