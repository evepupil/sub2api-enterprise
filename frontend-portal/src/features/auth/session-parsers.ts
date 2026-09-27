import type { AuthTokens, PortalOrganization, PortalUser } from './types';

type JsonObject = Record<string, unknown>;

export interface ParsedTokenPair {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapData(value: unknown): unknown {
  if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, 'code')) {
    return value;
  }
  if (value.code !== 0) {
    throw new TypeError('接口返回失败');
  }
  return value.data;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 2048) {
    throw new TypeError('接口字段格式不正确');
  }
  return value;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError('接口字段格式不正确');
  }
  return value;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('接口字段格式不正确');
  }
  return value;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError('接口字段格式不正确');
  }
  return value;
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return requiredString(value);
}

function usernameValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string' || value.length > 2048) {
    throw new TypeError('接口字段格式不正确');
  }
  return value;
}

function parseOrganization(value: unknown): PortalOrganization | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isObject(value)) {
    throw new TypeError('接口字段格式不正确');
  }
  return {
    id: positiveInteger(value.id),
    name: requiredString(value.name),
    isOwner: booleanValue(value.isOwner ?? value.is_owner),
    // Login's organization summary can omit status; permissions remain backend-enforced.
    status: usernameValue(value.status),
  };
}

/** Convert the public `/auth/me` shape into the small portal user model. */
export function parseUser(value: unknown): PortalUser {
  const unwrapped = unwrapData(value);
  if (!isObject(unwrapped)) {
    throw new TypeError('用户资料格式不正确');
  }

  const role = unwrapped.role;
  if (role !== 'admin' && role !== 'user') {
    throw new TypeError('用户资料格式不正确');
  }

  return {
    id: positiveInteger(unwrapped.id),
    email: requiredString(unwrapped.email),
    username: usernameValue(unwrapped.username),
    balance: finiteNumber(unwrapped.balance),
    frozenBalance: finiteNumber(unwrapped.frozenBalance ?? unwrapped.frozen_balance),
    role,
    organization: parseOrganization(unwrapped.organization),
  };
}

function parseExpiresAt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError('令牌有效期格式不正确');
  }
  return value;
}

function parseExpiresIn(value: unknown, now: () => number): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError('令牌有效期格式不正确');
  }
  const expiresAt = now() + value * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new TypeError('令牌有效期格式不正确');
  }
  return expiresAt;
}

/** Parse token fields returned by refresh without requiring a user object. */
export function parseTokenPair(value: unknown, now: () => number = Date.now): ParsedTokenPair {
  const unwrapped = unwrapData(value);
  if (!isObject(unwrapped)) {
    throw new TypeError('令牌响应格式不正确');
  }

  const accessToken = requiredString(unwrapped.access_token ?? unwrapped.accessToken);
  const refreshToken = optionalString(unwrapped.refresh_token ?? unwrapped.refreshToken);
  const expiresAt =
    unwrapped.expires_at !== undefined || unwrapped.expiresAt !== undefined
      ? parseExpiresAt(unwrapped.expires_at ?? unwrapped.expiresAt)
      : parseExpiresIn(unwrapped.expires_in ?? unwrapped.expiresIn, now);

  return { accessToken, refreshToken, expiresAt };
}

/** Parse the login completion response, including its server-verified user. */
export function parseAuthTokens(value: unknown, now: () => number = Date.now): AuthTokens {
  const unwrapped = unwrapData(value);
  if (!isObject(unwrapped)) {
    throw new TypeError('登录响应格式不正确');
  }
  const pair = parseTokenPair(unwrapped, now);
  return {
    ...pair,
    user: parseUser(unwrapped.user),
  };
}
