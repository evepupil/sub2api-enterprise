/**
 * 账号设置（个人资料、密码、双重验证）接口适配。
 *
 * 契约来源：design/customer-console.md 第 2、3 节；旧前端 `src/api/user.ts`
 * 与 `src/api/totp.ts`（接口路径），旧 `src/types/index.ts`（TOTP 字段）。
 *
 * 浏览器请求统一走注入的 `ApiRequester`（内部已附加凭证并统一解包 `data`），
 * 本模块不接触令牌、不读写浏览器存储。所有响应先经纯函数 parser 校验，
 * 再转成页面使用的 camelCase 模型，parser 可独立单测。
 */

import type { ApiRequester } from '../auth/types';

/** 归一后的双重验证状态。`featureEnabled=false` 时页面不提供任何操作。 */
export interface TotpStatus {
  enabled: boolean;
  /** 上次启用时间（Unix 秒），后端未提供时为 null。 */
  enabledAt: number | null;
  featureEnabled: boolean;
}

/** 设置/关闭双重验证所需的验证方式。 */
export type TotpVerificationMethod = 'email' | 'password';

/** setup 返回的一次性信息，只在本次弹窗内存中存在，不持久化。 */
export interface TotpSetup {
  secret: string;
  /** otpauth:// URI，用于本地生成二维码，不能直接当作外链图片。 */
  qrCodeUrl: string;
  setupToken: string;
  /** setup token / 二维码剩余有效秒数。 */
  countdown: number;
}

/** 设置或关闭双重验证时二选一的凭证。 */
export type TotpCredential = { emailCode: string } | { password: string };

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidField(): TypeError {
  return new TypeError('接口字段格式不正确');
}

function requiredString(value: unknown, maxLength = 4096): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw invalidField();
  }
  return value;
}

function optionalTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidField();
  }
  return value;
}

/** 校验并归一 TOTP 状态。缺少/非布尔的开关按 false 处理（安全降级为不可操作）。 */
export function parseTotpStatus(value: unknown): TotpStatus {
  if (!isObject(value)) {
    throw invalidField();
  }
  return {
    enabled: value.enabled === true,
    enabledAt: optionalTimestamp(value.enabled_at),
    featureEnabled: value.feature_enabled === true,
  };
}

/** 校验验证方式；只接受 'email' 或 'password'。 */
export function parseVerificationMethod(value: unknown): TotpVerificationMethod {
  if (!isObject(value)) {
    throw invalidField();
  }
  const method = value.method;
  if (method !== 'email' && method !== 'password') {
    throw invalidField();
  }
  return method;
}

/** 校验 setup 响应，secret/qr_code_url/setup_token/countdown 缺一不可；countdown 必须为正。 */
export function parseTotpSetup(value: unknown): TotpSetup {
  if (!isObject(value)) {
    throw invalidField();
  }
  const countdown = value.countdown;
  if (typeof countdown !== 'number' || !Number.isFinite(countdown) || countdown <= 0) {
    throw invalidField();
  }
  return {
    secret: requiredString(value.secret),
    qrCodeUrl: requiredString(value.qr_code_url, 8192),
    setupToken: requiredString(value.setup_token, 8192),
    countdown,
  };
}

/** 校验 `{ success }` 类响应；不是明确的 true 都按未成功处理。 */
export function parseSuccess(value: unknown): boolean {
  return isObject(value) && value.success === true;
}

/**
 * 把请求错误转成可展示的中文文案。
 *
 * `ApiError` 的 message 由请求层生成为本地安全文案，不包含后端原文；
 * 其他异常（如 parser 抛出的 TypeError）一律使用调用方给的兜底文案。
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === 'ApiError' && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

function credentialBody(credential: TotpCredential): Record<string, string> {
  if ('emailCode' in credential) {
    return { email_code: credential.emailCode };
  }
  return { password: credential.password };
}

export function fetchTotpStatus(request: ApiRequester, signal?: AbortSignal): Promise<TotpStatus> {
  return request<unknown>('/user/totp/status', { method: 'GET', signal }).then(parseTotpStatus);
}

export function fetchVerificationMethod(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<TotpVerificationMethod> {
  return request<unknown>('/user/totp/verification-method', { method: 'GET', signal }).then(
    parseVerificationMethod,
  );
}

/** 发送邮箱验证码（写操作，调用方不得自动重试）。 */
export function sendTotpEmailCode(request: ApiRequester): Promise<boolean> {
  return request<unknown>('/user/totp/send-code', { method: 'POST' }).then(parseSuccess);
}

/** 开始设置：返回 secret、otpauth URI、一次性 setup_token 与倒计时。 */
export function startTotpSetup(
  request: ApiRequester,
  credential: TotpCredential,
  signal?: AbortSignal,
): Promise<TotpSetup> {
  return request<unknown>('/user/totp/setup', {
    method: 'POST',
    body: credentialBody(credential),
    signal,
  }).then(parseTotpSetup);
}

export function enableTotp(
  request: ApiRequester,
  input: { totpCode: string; setupToken: string },
): Promise<boolean> {
  return request<unknown>('/user/totp/enable', {
    method: 'POST',
    body: { totp_code: input.totpCode, setup_token: input.setupToken },
  }).then(parseSuccess);
}

export function disableTotp(request: ApiRequester, credential: TotpCredential): Promise<boolean> {
  return request<unknown>('/user/totp/disable', {
    method: 'POST',
    body: credentialBody(credential),
  }).then(parseSuccess);
}

/** 更新个人资料；成功后调用方需要 refreshUser 核实最新账号。 */
export function updateUsername(request: ApiRequester, username: string): Promise<void> {
  return request<unknown>('/user', { method: 'PUT', body: { username } }).then(() => undefined);
}

/** 修改密码；成功后调用方负责清理登录态，不在此处保存任何密码。 */
export function changePassword(
  request: ApiRequester,
  input: { oldPassword: string; newPassword: string },
): Promise<void> {
  return request<unknown>('/user/password', {
    method: 'PUT',
    body: { old_password: input.oldPassword, new_password: input.newPassword },
  }).then(() => undefined);
}
