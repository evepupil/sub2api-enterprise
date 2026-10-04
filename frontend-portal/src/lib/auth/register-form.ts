import { isEmailSuffixAllowed } from './email-suffix';
import type { AuthSettings } from './settings';

/**
 * 注册表单的规则，与现有 sub2api 注册页（frontend/src/views/auth/RegisterView.vue）一致。纯函数，单测锁住。
 *
 * - 邀请码框始终显示：后台开了「邀请码注册」时必填，否则选填；填了就一定要校验通过才能提交。
 * - 邀请码被识别为组织邀请码时，注册后加入该组织，不能再选「创建组织」。
 * - 创建组织或凭组织邀请码加入时，必须填「你在组织中的名称」。
 * - 优惠码填了就必须校验通过；密码至少 6 位；后台设了邮箱后缀白名单时提交前就预检
 *   （开了按域名限量注册时交给后端判断）。
 */

export const PASSWORD_MIN_LENGTH = 6;
export const ORG_NAME_MAX_LENGTH = 100;
export const MEMBER_NAME_MAX_LENGTH = 50;

/** 邮箱格式（只查有没有 @ 和点，严格校验交给后端）；登录、注册、找回密码共用 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterValues {
  orgName: string;
  email: string;
  password: string;
  invite: string;
  memberName: string;
  promo: string;
  aff: string;
}

export const EMPTY_REGISTER_VALUES: RegisterValues = {
  orgName: '',
  email: '',
  password: '',
  invite: '',
  memberName: '',
  promo: '',
  aff: '',
};

/** 邀请码 / 优惠码的实时校验状态 */
export type CodeCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid'; kind?: 'platform' | 'organization'; bonusAmount?: number }
  | { status: 'invalid'; errorCode: string };

export const IDLE: CodeCheck = { status: 'idle' };

export interface RegisterContext {
  settings: AuthSettings;
  /** 用户选了「创建组织」 */
  creatingOrganization: boolean;
  invitation: CodeCheck;
}

/** 邀请码已识别为组织邀请码 */
export function isOrganizationInvitation(check: CodeCheck): boolean {
  return check.status === 'valid' && check.kind === 'organization';
}

/** 实际是在创建组织：选了创建组织，且邀请码不是组织邀请码（组织邀请码优先，只能加入） */
export function isCreatingOrganization(ctx: RegisterContext): boolean {
  return ctx.creatingOrganization && !isOrganizationInvitation(ctx.invitation);
}

/** 要不要填「你在组织中的名称」 */
export function needsMemberName(ctx: RegisterContext): boolean {
  return isCreatingOrganization(ctx) || isOrganizationInvitation(ctx.invitation);
}

export type RegisterField = 'orgName' | 'email' | 'password' | 'invite' | 'memberName';

/** 出错时焦点的先后顺序 */
export const REGISTER_FIELD_ORDER: readonly RegisterField[] = [
  'orgName',
  'email',
  'password',
  'invite',
  'memberName',
];

export type RegisterFieldError =
  | 'orgNameRequired'
  | 'emailRequired'
  | 'emailInvalid'
  | 'emailSuffix'
  | 'passwordRequired'
  | 'passwordShort'
  | 'inviteRequired'
  | 'memberNameRequired';

export type RegisterErrors = Partial<Record<RegisterField, RegisterFieldError>>;

/** 逐个字段检查，每个字段只报第一条错误 */
export function validateRegister(values: RegisterValues, ctx: RegisterContext): RegisterErrors {
  const errors: RegisterErrors = {};
  const email = values.email.trim();

  if (isCreatingOrganization(ctx) && values.orgName.trim() === '')
    errors.orgName = 'orgNameRequired';

  if (email === '') errors.email = 'emailRequired';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'emailInvalid';
  else if (
    !ctx.settings.emailDomainQuotaEnabled &&
    !isEmailSuffixAllowed(email, ctx.settings.emailSuffixWhitelist)
  ) {
    errors.email = 'emailSuffix';
  }

  if (values.password === '') errors.password = 'passwordRequired';
  else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = 'passwordShort';

  if (ctx.settings.invitationCodeEnabled && values.invite.trim() === '')
    errors.invite = 'inviteRequired';

  if (needsMemberName(ctx) && values.memberName.trim() === '')
    errors.memberName = 'memberNameRequired';

  return errors;
}

/** 字段都填对了，但邀请码或优惠码的校验结果不允许提交 */
export type SubmitBlock = 'promoChecking' | 'promoInvalid' | 'inviteChecking' | 'inviteInvalid';

/**
 * 提交前看邀请码与优惠码：填了的必须校验通过。邀请码填了却还没校验（防抖还没触发）时返回 null，
 * 由界面先触发一次校验再判断。
 */
export function submitBlockFor(
  values: RegisterValues,
  promo: CodeCheck,
  invitation: CodeCheck,
): SubmitBlock | null {
  if (values.promo.trim() !== '') {
    if (promo.status === 'checking') return 'promoChecking';
    if (promo.status === 'invalid') return 'promoInvalid';
  }
  if (values.invite.trim() !== '') {
    if (invitation.status === 'checking') return 'inviteChecking';
    if (invitation.status === 'invalid') return 'inviteInvalid';
  }
  return null;
}

/** 发给后端注册接口的内容（官网转发接口的请求体，字段名在服务端再换成后端的写法） */
export interface RegisterPayload {
  email: string;
  password: string;
  verifyCode?: string;
  invitationCode?: string;
  promoCode?: string;
  affCode?: string;
  organizationName?: string;
  organizationMemberName?: string;
}

const optional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export function registerPayload(
  values: RegisterValues,
  ctx: RegisterContext,
  verifyCode?: string,
): RegisterPayload {
  return {
    email: values.email.trim(),
    password: values.password,
    verifyCode: verifyCode ? verifyCode.trim() : undefined,
    invitationCode: optional(values.invite),
    promoCode: ctx.settings.promoCodeEnabled ? optional(values.promo) : undefined,
    affCode: optional(values.aff),
    organizationName: isCreatingOrganization(ctx) ? optional(values.orgName) : undefined,
    organizationMemberName: needsMemberName(ctx) ? optional(values.memberName) : undefined,
  };
}
