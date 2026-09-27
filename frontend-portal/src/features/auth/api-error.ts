export type ApiErrorCode = string | number | null;

const DEFAULT_MESSAGES: Record<number, string> = {
  400: '请求参数不正确',
  401: '登录状态已失效',
  403: '当前账号没有权限执行此操作',
  404: '请求的内容不存在',
  408: '请求超时，请稍后重试',
  409: '登录状态已变化，请重试',
  413: '请求内容过大',
  429: '请求过于频繁，请稍后重试',
};

const BUSINESS_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '邮箱或密码不正确',
  USER_NOT_ACTIVE: '当前账号已停用，请联系管理员',
  EMAIL_EXISTS: '该邮箱已注册，请直接登录',
  EMAIL_RESERVED: '该邮箱暂时无法注册',
  EMAIL_VERIFY_REQUIRED: '请先完成邮箱验证',
  EMAIL_SUFFIX_NOT_ALLOWED: '请使用允许的邮箱后缀',
  EMAIL_DOMAIN_REGISTRATION_LIMIT: '该邮箱域名已达到注册上限，请更换邮箱或联系管理员',
  REGISTRATION_DISABLED: '当前未开放注册',
  INVITATION_CODE_REQUIRED: '请输入邀请码',
  INVITATION_CODE_INVALID: '邀请码无效或已使用',
  VERIFY_CODE_REQUIRED: '请输入邮箱验证码',
  VERIFY_CODE_INVALID: '邮箱验证码不正确或已失效',
  TOTP_INVALID_CODE: '验证器验证码不正确',
  TOTP_SETUP_EXPIRED: '设置已超时，请重新开始',
  DAILY_LIMIT_EXCEEDED: '已达到今日充值限额',
  MAX_PENDING_ORDERS: '待付款订单过多，请先处理已有订单',
};

/**
 * Public request errors intentionally contain only a local, safe message.
 * Backend response text is never copied into the Error object.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = Number.isFinite(status) ? status : 0;
    this.code = code;
  }
}

export function safeApiMessage(status: number, code: ApiErrorCode = null): string {
  if (typeof code === 'string' && BUSINESS_MESSAGES[code]) return BUSINESS_MESSAGES[code];
  if (status >= 500) {
    return '服务暂时不可用，请稍后重试';
  }
  if (status === 0) {
    return '网络连接失败，请稍后重试';
  }
  if (DEFAULT_MESSAGES[status] !== undefined) {
    return DEFAULT_MESSAGES[status];
  }
  if (typeof code === 'string' && code.toLowerCase().includes('timeout')) {
    return '请求超时，请稍后重试';
  }
  return '请求未能完成，请稍后重试';
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
