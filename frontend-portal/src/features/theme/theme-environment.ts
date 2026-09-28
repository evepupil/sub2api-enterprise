import { SYSTEM_THEME_QUERY, THEME_STORAGE_KEY } from './theme-preference';
import type { ResolvedTheme, ThemePreference } from './theme-preference';

export interface ThemeEnvironment {
  readPreference(): unknown;
  writePreference(preference: ThemePreference): void;
  prefersDark(): boolean;
  applyTheme(theme: ResolvedTheme): void;
  subscribeSystem(listener: () => void): () => void;
  subscribeStorage(listener: () => void): () => void;
}

/** The environment is only connected by client subscriptions, never during SSR. */
export function createThemeEnvironment(): ThemeEnvironment | null {
  if (typeof window === 'undefined') return null;
  const media =
    typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_THEME_QUERY) : null;
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Switching remains available when browser storage is blocked.
  }

  return {
    readPreference: () => {
      if (storage === null) throw new Error('Theme storage unavailable');
      return storage.getItem(THEME_STORAGE_KEY);
    },
    writePreference: (preference) => {
      if (storage === null) throw new Error('Theme storage unavailable');
      storage.setItem(THEME_STORAGE_KEY, preference);
    },
    prefersDark: () => media?.matches ?? false,
    applyTheme: (theme) => {
      document.documentElement.dataset.theme = theme;
    },
    subscribeSystem: (listener) => {
      media?.addEventListener('change', listener);
      return () => media?.removeEventListener('change', listener);
    },
    subscribeStorage: (listener) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
        if (event.storageArea !== null && event.storageArea !== storage) return;
        listener();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    },
  };
}
