import type { AuthSettings, CaptchaProof } from './types';

export type PendingMode =
  | 'processing'
  | 'choose'
  | 'create-account'
  | 'email-completion'
  | 'bind-login'
  | 'adoption'
  | 'totp'
  | 'completed'
  | 'error';

export type AdoptionDecision = { adopt_display_name: boolean; adopt_avatar: boolean };

export interface OAuthFragmentData {
  tokenResponse: Record<string, unknown> | null;
  redirect: string | null;
  hasError: boolean;
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function pendingMode(value: Record<string, unknown>): PendingMode | null {
  const state = normalized(value.step ?? value.error ?? value.intent);
  if (state === 'email_completion') return 'email-completion';
  if (
    state === 'invitation_required' ||
    state === 'registration_completion_required' ||
    state === 'email_required' ||
    state === 'create_account_required' ||
    state === 'create_account'
  ) {
    return 'create-account';
  }
  if (
    state === 'choice' ||
    state === 'choose_account_action_required' ||
    state === 'choose_account_action' ||
    state === 'choose_account' ||
    state === 'choose'
  ) {
    return 'choose';
  }
  if (
    state === 'bind_login_required' ||
    state === 'bind_login' ||
    state === 'existing_account' ||
    state === 'existing_account_required' ||
    state === 'existing_account_binding_required' ||
    state === 'adopt_existing_user_by_email'
  ) {
    return 'bind-login';
  }
  return null;
}

export function providerFromPath(pathname: string): string {
  const match = /\/auth\/(linuxdo|oidc|dingtalk|wechat)\/callback$/u.exec(pathname);
  return match?.[1] ?? '';
}

export function hasCaptcha(settings: AuthSettings): boolean {
  return (
    settings.turnstileSiteKey !== null || settings.tencentAppId !== null || settings.aliyun !== null
  );
}

export function parseOAuthFragment(url: URL): OAuthFragmentData {
  const raw = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token')?.trim() ?? '';
  const hasError =
    (params.get('error_description')?.trim() ?? '') !== '' ||
    (params.get('error')?.trim() ?? '') !== '';
  if (accessToken === '') {
    return { tokenResponse: null, redirect: null, hasError };
  }

  const tokenResponse: Record<string, unknown> = { access_token: accessToken };
  const refreshToken = params.get('refresh_token')?.trim() ?? '';
  const expiresIn = Number.parseInt(params.get('expires_in') ?? '', 10);
  const tokenType = params.get('token_type')?.trim() ?? '';
  if (refreshToken !== '') tokenResponse.refresh_token = refreshToken;
  if (Number.isFinite(expiresIn) && expiresIn > 0) tokenResponse.expires_in = expiresIn;
  if (tokenType !== '') tokenResponse.token_type = tokenType;
  return {
    tokenResponse,
    redirect: params.get('redirect'),
    hasError,
  };
}

export function genericOAuthError(): string {
  return '第三方登录未完成，请返回登录后重试。';
}

export function invalidOAuthResponseError(): string {
  return '第三方登录响应无效，请返回登录后重试。';
}

export type OAuthProof = CaptchaProof | undefined;
