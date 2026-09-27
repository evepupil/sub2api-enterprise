export interface KeyRecord {
  id: number;
  name: string;
  key: string;
  status: string;
  groupId: number | null;
  groupName: string | null;
  quota: number;
  quotaUsed: number;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  ipWhitelist: string[];
  ipBlacklist: string[];
  limit5h: number;
  limit1d: number;
  limit7d: number;
}

export interface AvailableGroup {
  id: number;
  name: string;
  platform: string;
  subscriptionType: string;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
export interface KeyFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}
export interface KeyDraft {
  name: string;
  groupId: number | null;
  quota: string;
  expiresInDays: string;
  expiresAt: string;
  ipWhitelist: string;
  ipBlacklist: string;
  limit5h: string;
  limit1d: string;
  limit7d: string;
}
