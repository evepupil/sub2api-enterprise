const SAFE_ORIGIN = 'https://portal.invalid';

/** Keep post-auth navigation inside this portal. */
export function safeReturnPath(input: string | undefined, fallback = '/console'): string {
  if (typeof input !== 'string' || input.length === 0 || !input.startsWith('/')) {
    return fallback;
  }
  if (input.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(input)) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(input);
    const parsed = new URL(input, SAFE_ORIGIN);
    if (
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f\u007f]/u.test(decoded) ||
      parsed.origin !== SAFE_ORIGIN ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
