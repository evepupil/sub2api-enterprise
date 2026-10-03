import { PASSWORD_MIN_LENGTH, PROFILE_NAME_MAX, TWO_FACTOR_CODE_LENGTH } from './settings-config';

/** 账户设置页的表单校验：纯函数，返回错误类型，由界面换成对应语言的文案 */

export type ProfileNameError = 'nameRequired' | 'nameTooLong';

/** 名称：去掉首尾空格后不能为空，最多 32 个字 */
export function validateProfileName(name: string): ProfileNameError | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'nameRequired';
  if (trimmed.length > PROFILE_NAME_MAX) return 'nameTooLong';
  return null;
}

export interface PasswordValues {
  current: string;
  next: string;
  confirm: string;
}

export type PasswordField = keyof PasswordValues;

export type PasswordError =
  'currentRequired' | 'newTooShort' | 'newSameAsCurrent' | 'confirmMismatch';

export type PasswordErrors = Partial<Record<PasswordField, PasswordError>>;

/**
 * 修改密码：当前密码必填；新密码至少 8 位且不能和当前密码相同；确认密码必须和新密码一致。
 * 密码里的空格也算密码的一部分，不做去空格处理。每个字段只报它的第一条错误。
 */
export function validatePasswordForm(values: PasswordValues): PasswordErrors {
  const errors: PasswordErrors = {};
  if (values.current === '') errors.current = 'currentRequired';

  if (values.next.length < PASSWORD_MIN_LENGTH) errors.next = 'newTooShort';
  else if (values.next === values.current) errors.next = 'newSameAsCurrent';

  if (values.confirm !== values.next) errors.confirm = 'confirmMismatch';
  return errors;
}

/** 动态码输入框只收数字，最多 6 位：粘贴进来的空格、横线都会被去掉 */
export function sanitizeTwoFactorCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, TWO_FACTOR_CODE_LENGTH);
}

export function isValidTwoFactorCode(code: string): boolean {
  return code.length === TWO_FACTOR_CODE_LENGTH && /^\d+$/.test(code);
}
