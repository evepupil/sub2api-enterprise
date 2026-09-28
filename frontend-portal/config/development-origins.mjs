// @ts-check

/** @typedef {{ NODE_ENV?: string, PORTAL_PUBLIC_URL?: string, PORTAL_DEV_ORIGINS?: string }} PortalOriginEnvironment */

const LOCAL_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'];

/** @param {string | null | undefined} value @returns {string | null} */
function originOf(value) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Exact browser origins shared by the dev resource guard and the API proxy.
 * @param {PortalOriginEnvironment} environment
 * @returns {string[]}
 */
export function developmentOrigins(environment) {
  const values = [
    ...LOCAL_ORIGINS,
    environment.PORTAL_PUBLIC_URL,
    ...(environment.PORTAL_DEV_ORIGINS ?? '').split(','),
  ];
  return [...new Set(values.map(originOf).filter((origin) => origin !== null))];
}

/** Next matches hostnames, while API writes also validate scheme and port.
 * @param {PortalOriginEnvironment} environment
 * @returns {string[]}
 */
export function allowedDevelopmentHosts(environment) {
  return [...new Set(developmentOrigins(environment).map((origin) => new URL(origin).hostname))];
}

/** Select only a configured browser origin; forwarded headers never extend the allowlist.
 * Production keeps the existing fixed-origin behavior.
 * @param {Request} request
 * @param {PortalOriginEnvironment} environment
 * @returns {string | undefined}
 */
export function portalRequestOrigin(request, environment) {
  if (environment.NODE_ENV !== 'development') return environment.PORTAL_PUBLIC_URL;
  const canonical = environment.PORTAL_PUBLIC_URL ?? LOCAL_ORIGINS[0];
  const allowed = new Set(developmentOrigins(environment));
  const source = request.headers.get('origin');
  if (source !== null && source.trim() !== '') {
    const origin = originOf(source);
    return origin !== null && allowed.has(origin) ? origin : canonical;
  }

  const url = new URL(request.url);
  const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwarded = host === null ? null : originOf(`${protocol}://${host}`);
  if (forwarded !== null && allowed.has(forwarded)) return forwarded;
  return allowed.has(url.origin) ? url.origin : canonical;
}
