/** 官网匿名数据契约。仅允许明确定义的公开字段进入网页。 */
export type PublicResult<T> =
  { kind: 'ready'; data: T } | { kind: 'unavailable' | 'disabled' | 'authentication-required' };

export type PriceKey = 'input' | 'cacheWrite' | 'cacheRead' | 'output';

export interface PriceRange {
  min: number;
  max: number;
}

export interface CatalogModel {
  id: string;
  provider: string;
  providerKey: string;
  prices: Record<PriceKey, PriceRange | null>;
}

export interface CatalogData {
  models: CatalogModel[];
}

export type StatusLevel = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface AvailabilityPoint {
  level: StatusLevel;
  checkedAt: string;
}

export interface StatusComponent {
  name: string;
  groupName: string | null;
  level: StatusLevel;
  availability: number | null;
  latencyMs: number | null;
  history: AvailabilityPoint[];
}

export interface StatusData {
  level: StatusLevel;
  updatedAt: string;
  availability: number | null;
  components: StatusComponent[];
}

export interface PublicSettings {
  siteName: string;
  contactInfo: string | null;
  documentationUrl: string | null;
  registrationEnabled: boolean;
}

export interface PublicAction {
  href: string;
  label: string;
  primary?: boolean;
}

export interface PublicSiteData {
  settings: PublicSettings;
  accountActions: PublicAction[];
}
