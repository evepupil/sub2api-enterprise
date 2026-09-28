// @vitest-environment jsdom

import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_BOOTSTRAP_SCRIPT } from '../src/features/theme/theme-bootstrap';
import { THEME_STORAGE_KEY } from '../src/features/theme/theme-preference';
import { createThemeStore } from '../src/features/theme/theme-store';

function createSystemPreference() {
  let dark = false;
  const target = new EventTarget();
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return (value: boolean) => {
    dark = value;
    target.dispatchEvent(new Event('change'));
  };
}

const cleanups: Array<() => void> = [];
let setSystemDark: ReturnType<typeof createSystemPreference>;

function connect(store: ReturnType<typeof createThemeStore>, listener = vi.fn()) {
  const stop = store.subscribe(listener);
  cleanups.push(stop);
  return stop;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'dark';
  setSystemDark = createSystemPreference();
});

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('theme preference lifecycle', () => {
  it('restores the saved choice while keeping a stable server snapshot', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const store = createThemeStore();
    const serverSnapshot = store.getServerSnapshot();
    connect(store);
    expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(store.getServerSnapshot()).toBe(serverSnapshot);
    expect(serverSnapshot).toEqual({ preference: 'dark', resolved: 'dark' });
  });

  it('persists a choice and applies CSS before notifying chart or form subscribers', () => {
    const store = createThemeStore();
    const observed: string[] = [];
    connect(
      store,
      vi.fn(() => {
        observed.push(
          `${window.localStorage.getItem(THEME_STORAGE_KEY)}:${document.documentElement.dataset.theme}`,
        );
      }),
    );
    store.setPreference('light');
    expect(observed).toEqual(['light:light']);
    expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' });
  });

  it('follows system changes only while system is selected', () => {
    const store = createThemeStore();
    connect(store);
    store.setPreference('system');
    expect(store.getSnapshot().resolved).toBe('light');
    setSystemDark(true);
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' });
    store.setPreference('light');
    setSystemDark(false);
    setSystemDark(true);
    expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('uses the latest shared preference on storage events without writing it back', () => {
    const store = createThemeStore();
    connect(store);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'dark',
        storageArea: window.localStorage,
      }),
    );
    expect(store.getSnapshot().resolved).toBe('light');
    expect(write).not.toHaveBeenCalled();
  });

  it('ignores account storage and session-storage notifications', () => {
    const store = createThemeStore();
    connect(store);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'unrelated-account-key',
        storageArea: window.localStorage,
      }),
    );
    window.dispatchEvent(
      new StorageEvent('storage', { key: THEME_STORAGE_KEY, storageArea: window.sessionStorage }),
    );
    expect(store.getSnapshot().resolved).toBe('dark');
  });

  it('returns to the default when another tab clears preferences', () => {
    const store = createThemeStore();
    connect(store);
    store.setPreference('light');
    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, storageArea: window.localStorage }),
    );
    expect(store.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' });
  });

  it('remains usable with blocked storage and preserves the current session on reconnect', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = createThemeStore();
    const stop = connect(store);
    expect(() => store.setPreference('light')).not.toThrow();
    stop();
    connect(store);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('releases listeners only after the last consumer and restores changes made while disconnected', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    const store = createThemeStore();
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = connect(store, first);
    const stopSecond = connect(store, second);
    stopFirst();
    setSystemDark(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    stopSecond();
    setSystemDark(false);
    expect(document.documentElement.dataset.theme).toBe('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    connect(store, first);
    stopFirst(); // An already released subscription must not remove a later subscription.
    expect(document.documentElement.dataset.theme).toBe('light');
    store.setPreference('dark');
    expect(first).toHaveBeenCalledOnce();
  });

  it('safely rejects an unknown stored theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'unexpected-theme');
    const store = createThemeStore();
    connect(store);
    expect(store.getSnapshot().resolved).toBe('dark');
  });
});

describe('theme before first paint', () => {
  it.each([
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['corrupt', false, 'dark'],
  ] as const)('restores %s with system dark=%s', (saved, systemDark, expected) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, saved);
    setSystemDark(systemDark);
    runInNewContext(THEME_BOOTSTRAP_SCRIPT, { window, document });
    expect(document.documentElement.dataset.theme).toBe(expected);
    const store = createThemeStore();
    connect(store);
    expect(store.getSnapshot().resolved).toBe(expected);
  });

  it('does not block page startup when browser storage is inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => runInNewContext(THEME_BOOTSTRAP_SCRIPT, { window, document })).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
