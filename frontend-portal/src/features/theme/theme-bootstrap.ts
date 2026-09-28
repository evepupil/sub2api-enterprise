import { DEFAULT_THEME, SYSTEM_THEME_QUERY, THEME_STORAGE_KEY } from './theme-preference';

/** Small synchronous head script: apply the saved palette before the body is painted. */
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  let preference = ${JSON.stringify(DEFAULT_THEME)};
  try {
    const saved = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved;
  } catch {}
  const dark = typeof window.matchMedia === 'function' && window.matchMedia(${JSON.stringify(SYSTEM_THEME_QUERY)}).matches;
  document.documentElement.dataset.theme = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
})();`;
