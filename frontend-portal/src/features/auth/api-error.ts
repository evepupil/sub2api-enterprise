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
  ORGANIZATION_OWNER_REQUIRED: '此操作仅限组织管理员',
  ORGANIZATION_MEMBER_NOT_FOUND: '该成员不存在或已不属于当前组织',
  ORGANIZATION_MEMBER_OWNER_IMMUTABLE: '组织管理员不能进行此项成员操作',
  ORGANIZATION_MEMBER_PLATFORM_ADMIN: '无法修改平台管理员的成员状态',
  ORGANIZATION_MEMBER_NAME_INVALID: '成员名称需要1至50个字符',
  ORGANIZATION_SPENDING_LIMIT_INVALID: '请输入有效的非负消费上限',
  ORGANIZATION_QUOTA_PERIOD_INVALID: '周期需要填写1至3650天',
  ORGANIZATION_QUOTA_AMOUNT_INVALID: '请输入有效的非负周期额度',
  ORGANIZATION_QUOTA_START_INVALID: '配额生效日期无效',
  ORGANIZATION_QUOTA_REQUEST_DISABLED: '当前组织未开放配额申请',
  ORGANIZATION_QUOTA_REQUEST_AMOUNT_INVALID: '申请金额超出组织允许范围',
  ORGANIZATION_QUOTA_REQUEST_PENDING_EXISTS: '已有一条待处理的配额申请',
  ORGANIZATION_QUOTA_REQUEST_NOT_PENDING: '该申请已处理，请查看最新状态',
  ORGANIZATION_QUOTA_REQUEST_MEMBER_INELIGIBLE: '成员状态或额度已变化，请查看最新申请状态',
  ORGANIZATION_QUOTA_REQUEST_NOT_FOUND: '该申请不存在或无法访问',
  ORGANIZATION_QUOTA_REQUEST_RANGE_INVALID: '申请金额范围无效，请检查最小和最大金额',
  ORGANIZATION_QUOTA_REQUEST_REASON_TOO_LONG: '申请理由不能超过500个字符',
  ORGANIZATION_QUOTA_REQUEST_NOTE_TOO_LONG: '审批备注不能超过500个字符',
  REDEEM_CODE_EXPIRED: '邀请码已过期，或设置的到期时间已过去',
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
