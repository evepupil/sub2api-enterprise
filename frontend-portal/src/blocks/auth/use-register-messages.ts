'use client';

import { useLocale, useTranslations } from 'next-intl';

import { formatSuffixesForMessage } from '@/lib/auth/email-suffix';
import type { CodeCheck, RegisterFieldError, SubmitBlock } from '@/lib/auth/register-form';
import type { AuthSettings } from '@/lib/auth/settings';
import type { AuthErrorReason } from '@/lib/session/types';

/** 注册页有专门提示的后端原因；其余统一「注册失败，请稍后再试」 */
const REGISTER_REASONS = [
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
  'ORGANIZATION_DISABLED',
  'OAUTH_SESSION_EXPIRED',
  'TOO_MANY_REQUESTS',
  'BACKEND_UNAVAILABLE',
] as const satisfies readonly AuthErrorReason[];

type RegisterReason = (typeof REGISTER_REASONS)[number];

const isRegisterReason = (reason: AuthErrorReason): reason is RegisterReason =>
  (REGISTER_REASONS as readonly string[]).includes(reason);

export interface StatusLine {
  tone: 'muted' | 'success' | 'danger';
  text: string;
}

/**
 * 注册页的提示文字：字段错误、后端原因、提交被拦的原因、邀请码与优惠码的校验状态。
 * 后端原因按注册页的说法显示，不展示后端英文说明。
 */
export function useRegisterMessages(settings: AuthSettings) {
  const t = useTranslations('auth');
  const locale = useLocale();

  const fieldError = (error: RegisterFieldError | undefined): string | undefined => {
    if (!error) return undefined;
    if (error === 'emailSuffix') {
      const suffixes = formatSuffixesForMessage(
        settings.emailSuffixWhitelist,
        locale === 'zh' ? '、' : ', ',
        (count) => t('fields.errors.emailSuffixMore', { count }),
      );
      return t('fields.errors.emailSuffix', { suffixes });
    }
    return t(`fields.errors.${error}`);
  };

  const reasonMessage = (reason: AuthErrorReason): string => {
    if (reason === 'CAPTCHA_FAILED') return t('captcha.failed');
    if (reason === 'CAPTCHA_UNAVAILABLE') return t('captcha.unavailable');
    return isRegisterReason(reason) ? t(`register.errors.${reason}`) : t('register.errors.generic');
  };

  const blockMessage = (block: SubmitBlock): string => t(`register.blocks.${block}`);

  const inviteStatus = (check: CodeCheck): StatusLine | null => {
    if (check.status === 'checking') return { tone: 'muted', text: t('fields.checking') };
    if (check.status === 'valid') {
      return {
        tone: 'success',
        text:
          check.kind === 'organization'
            ? t('fields.inviteValidOrganization')
            : t('fields.inviteValid'),
      };
    }
    if (check.status === 'invalid') {
      return {
        tone: 'danger',
        text:
          check.errorCode === 'INVITATION_CODE_EXPIRED'
            ? t('fields.inviteExpired')
            : t('fields.inviteInvalid'),
      };
    }
    return null;
  };

  const promoStatus = (check: CodeCheck): StatusLine | null => {
    if (check.status === 'checking') return { tone: 'muted', text: t('fields.checking') };
    if (check.status === 'valid') {
      return {
        tone: 'success',
        text: t('fields.promoValid', { amount: (check.bonusAmount ?? 0).toFixed(2) }),
      };
    }
    if (check.status === 'invalid') {
      switch (check.errorCode) {
        case 'PROMO_CODE_NOT_FOUND':
          return { tone: 'danger', text: t('fields.promoNotFound') };
        case 'PROMO_CODE_EXPIRED':
          return { tone: 'danger', text: t('fields.promoExpired') };
        case 'PROMO_CODE_DISABLED':
          return { tone: 'danger', text: t('fields.promoDisabled') };
        case 'PROMO_CODE_MAX_USED':
          return { tone: 'danger', text: t('fields.promoMaxUsed') };
        case 'PROMO_CODE_ALREADY_USED':
          return { tone: 'danger', text: t('fields.promoAlreadyUsed') };
        default:
          return { tone: 'danger', text: t('fields.promoInvalid') };
      }
    }
    return null;
  };

  return { fieldError, reasonMessage, blockMessage, inviteStatus, promoStatus };
}
