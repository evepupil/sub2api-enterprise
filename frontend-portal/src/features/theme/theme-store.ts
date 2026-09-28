import { createThemeEnvironment } from './theme-environment';
import type { ThemeEnvironment } from './theme-environment';
import { parseThemePreference, resolveTheme } from './theme-preference';
import type { ResolvedTheme, ThemePreference } from './theme-preference';

export interface ThemeSnapshot {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
}

const SERVER_SNAPSHOT: ThemeSnapshot = Object.freeze({ preference: 'dark', resolved: 'dark' });

export function createThemeStore(
  getEnvironment: () => ThemeEnvironment | null = createThemeEnvironment,
) {
  let snapshot = SERVER_SNAPSHOT;
  let environment: ThemeEnvironment | null = null;
  let disconnect: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const publish = (preference: ThemePreference) => {
    if (environment === null) return;
    const resolved = resolveTheme(preference, environment.prefersDark());
    // CSS must be current before charts or embedded forms read the new palette.
    environment.applyTheme(resolved);
    if (snapshot.preference === preference && snapshot.resolved === resolved) return;
    snapshot = { preference, resolved };
    listeners.forEach((listener) => listener());
  };

  const restore = () => {
    try {
      publish(parseThemePreference(environment?.readPreference()));
    } catch {
      publish(snapshot.preference);
    }
  };

  const connect = () => {
    if (environment !== null) return;
    environment = getEnvironment();
    if (environment === null) return;
    restore();
    const stopSystem = environment.subscribeSystem(() => {
      if (snapshot.preference === 'system') publish('system');
    });
    const stopStorage = environment.subscribeStorage(restore);
    disconnect = () => {
      stopSystem();
      stopStorage();
      environment = null;
    };
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener: () => void) {
      connect();
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        if (listeners.size === 0) {
          disconnect?.();
          disconnect = null;
        }
      };
    },
    setPreference(preference: ThemePreference) {
      connect();
      try {
        environment?.writePreference(preference);
      } catch {
        // A denied write must not prevent the current page from changing theme.
      }
      publish(preference);
      if (listeners.size === 0) {
        disconnect?.();
        disconnect = null;
      }
    },
  };
}

export const themeStore = createThemeStore();
