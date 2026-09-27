export interface PortalOrganization {
  id: number;
  name: string;
  isOwner: boolean;
  status: string;
}

export interface PortalUser {
  id: number;
  email: string;
  username: string;
  balance: number;
  frozenBalance: number;
  role: 'admin' | 'user';
  organization: PortalOrganization | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  user: PortalUser;
}

export interface LoginChallenge {
  requires2fa: true;
  tempToken: string;
  maskedEmail: string;
}

export interface SessionSnapshot {
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  user: PortalUser | null;
  identityKey: string;
  error: string | null;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
  headers?: Record<string, string>;
}

export type ApiRequester = <T = unknown>(path: string, options?: ApiRequestOptions) => Promise<T>;

export interface CaptchaProof {
  turnstile_token?: string;
  tencent_captcha_ticket?: string;
  tencent_captcha_randstr?: string;
}

export interface AuthSettings {
  registrationEnabled: boolean;
  emailVerifyEnabled: boolean;
  passwordResetEnabled: boolean;
  invitationCodeEnabled: boolean;
  totpEnabled: boolean;
  turnstileSiteKey: string | null;
  tencentAppId: string | null;
  aliyun: { sceneId: string; prefix: string; region: string } | null;
  emailSuffixes: string[];
  agreement: {
    enabled: boolean;
    revision: string;
    documents: { id: string; title: string; content: string }[];
  };
  oauthProviders: { id: string; label: string }[];
  passkeyEnabled: boolean;
}

export interface AuthOperations {
  login(input: { email: string; password: string } & CaptchaProof): Promise<LoginChallenge | null>;
  completeTwoFactor(tempToken: string, code: string): Promise<void>;
  register(input: Record<string, unknown>): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
}
