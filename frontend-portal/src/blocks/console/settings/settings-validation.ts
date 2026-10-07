import { PASSWORD_MIN_LENGTH, PROFILE_NAME_MAX } from './settings-config';

/** 账户设置页的表单校验：纯函数，返回错误类型，由界面换成对应语言的文案 */

export type ProfileNameError = 'nameRequired' | 'nameTooLong';

/** 名称：去掉首尾空格后不能为空，最多 32 个字（按字符数，表情和生僻字算一个） */
export function validateProfileName(name: string): ProfileNameError | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'nameRequired';
  if (Array.from(trimmed).length > PROFILE_NAME_MAX) return 'nameTooLong';
  return null;
}

export interface PasswordValues {
  current: string;
  next: string;
  confirm: string;
}

export type PasswordField = keyof PasswordValues;

export type PasswordError =
  'currentRequired' | 'currentWrong' | 'newTooShort' | 'newSameAsCurrent' | 'confirmMismatch';

export type PasswordErrors = Partial<Record<PasswordField, PasswordError>>;

/**
 * 修改密码：当前密码必填；新密码至少 6 位且不能和当前密码相同；确认密码必须和新密码一致。
 * 密码里的空格也算密码的一部分，不做去空格处理。每个字段只报它的第一条错误。
 * 「当前密码不正确」（currentWrong）要提交后由后台判定，这里不产生。
 */
export function validatePasswordForm(values: PasswordValues): PasswordErrors {
  const errors: PasswordErrors = {};
  if (values.current === '') errors.current = 'currentRequired';

  if (values.next.length < PASSWORD_MIN_LENGTH) errors.next = 'newTooShort';
  else if (values.next === values.current) errors.next = 'newSameAsCurrent';

  if (values.confirm !== values.next) errors.confirm = 'confirmMismatch';
  return errors;
}
