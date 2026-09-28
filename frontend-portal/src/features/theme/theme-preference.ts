export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const THEME_STORAGE_KEY = 'portal.theme';
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';
export const DEFAULT_THEME: ThemePreference = 'dark';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'system' || value === 'dark' ? value : DEFAULT_THEME;
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
