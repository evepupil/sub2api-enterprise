/** The only browser storage key owned by the customer portal session. */
export const SESSION_STORAGE_KEY = 'model-portal.session.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedSession {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  userId: number;
  generation: string;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseToken(value: unknown, nullable: boolean): string | null | undefined {
  if (value === null && nullable) {
    return null;
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192) {
    return undefined;
  }
  return value;
}

function parseExpiry(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    return undefined;
  }
  return value;
}

/** Parse the deliberately small persisted shape; all other fields are ignored. */
export function parsePersistedSession(raw: string | null): PersistedSession | null {
  if (raw === null || raw.length === 0) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (!isObject(value)) {
      return null;
    }

    const accessToken = parseToken(value.accessToken, false);
    const refreshToken = parseToken(value.refreshToken, true);
    const expiresAt = parseExpiry(value.expiresAt);
    const userId = parsePositiveId(value.userId);
    const generationValue = value.generation;
    const generation =
      typeof generationValue === 'string'
        ? generationValue
        : typeof generationValue === 'number' && Number.isSafeInteger(generationValue)
          ? String(generationValue)
          : '';

    if (
      typeof accessToken !== 'string' ||
      refreshToken === undefined ||
      expiresAt === undefined ||
      userId === null ||
      generation.length === 0 ||
      generation.length > 256
    ) {
      return null;
    }

    return { accessToken, refreshToken, expiresAt, userId, generation };
  } catch {
    return null;
  }
}

export function serializePersistedSession(session: PersistedSession): string {
  return JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    userId: session.userId,
    generation: session.generation,
  });
}

/** Read storage without allowing a broken browser storage implementation to escape. */
export function safeGet(storage: StorageLike | null, key: string): string | null {
  if (storage === null) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(storage: StorageLike | null, key: string, value: string): boolean {
  if (storage === null) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(storage: StorageLike | null, key: string): boolean {
  if (storage === null) {
    return false;
  }
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
