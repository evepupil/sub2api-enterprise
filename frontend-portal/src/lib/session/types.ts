/**
 * 登录状态里浏览器能看到的东西：当前用户的基本信息。
 * 登录凭证本身不在这里——它们只放在页面脚本读不到的 cookie 里，由官网服务器使用。
 */
export interface SessionOrganization {
  id: number;
  name: string;
  /** 是否组织创建者（组织管理员） */
  isOwner: boolean;
}

export interface SessionUser {
  id: number;
  email: string;
  /** 用户名，可能为空 */
  username: string;
  /** 平台角色：admin 是平台管理员，user 是普通用户 */
  role: 'admin' | 'user';
  /** 所属组织；个人用户为 null */
  organization: SessionOrganization | null;
}

/**
 * 官网登录、注册接口对浏览器暴露的错误原因。后端的错误码会先归到这几类，界面按类显示中文提示，
 * 不直接展示后端的英文说明。注册相关的原因与后端错误码同名，方便对照。
 */
export const AUTH_ERROR_REASONS = [
  // 登录
  'INVALID_CREDENTIALS',
  'USER_NOT_ACTIVE',
  'ORGANIZATION_DISABLED',
  'TOO_MANY_REQUESTS',
  'TOTP_INVALID_CODE',
  'TWO_FACTOR_EXPIRED',
  'NOT_LOGGED_IN',
  // 注册
  'REGISTRATION_DISABLED',
  'EMAIL_EXISTS',
  'EMAIL_RESERVED',
  'EMAIL_SUFFIX_NOT_ALLOWED',
  'EMAIL_DOMAIN_REGISTRATION_LIMIT',
  'EMAIL_VERIFY_REQUIRED',
  'VERIFY_CODE_REQUIRED',
  'INVALID_VERIFY_CODE',
  'VERIFY_CODE_TOO_FREQUENT',
  'VERIFY_CODE_MAX_ATTEMPTS',
  'INVITATION_CODE_REQUIRED',
  'INVITATION_CODE_INVALID',
  'PROMO_CODE_INVALID',
  'ORGANIZATION_NAME_INVALID',
  'ORGANIZATION_MEMBER_NAME_INVALID',
  'ORGANIZATION_REGISTRATION_CONFLICT',
  'USER_ALREADY_IN_ORGANIZATION',
  'CAPTCHA_REQUIRED',
  // 通用
  'BAD_REQUEST',
  'FORBIDDEN_ORIGIN',
  'BACKEND_UNAVAILABLE',
  'UNKNOWN',
] as const;

export type AuthErrorReason = (typeof AUTH_ERROR_REASONS)[number];

export function isAuthErrorReason(value: unknown): value is AuthErrorReason {
  return typeof value === 'string' && (AUTH_ERROR_REASONS as readonly string[]).includes(value);
}

/** 官网登录接口的错误响应体 */
export interface AuthErrorBody {
  ok: false;
  error: { reason: AuthErrorReason; status: number };
}
