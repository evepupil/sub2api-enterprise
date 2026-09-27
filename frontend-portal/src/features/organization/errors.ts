/**
 * 组织业务界面的错误边界。
 *
 * 本地表单校验可以把明确的输入问题展示给用户；接口错误只展示
 * auth/api-error.ts 提供的安全业务文案，适配器、运行时和其它异常统一使用调用方兜底文案。
 */

import { isApiError, safeApiMessage } from '../auth/api-error';

export class OrganizationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrganizationInputError';
  }
}

export function organizationErrorText(error: unknown, fallback: string): string {
  if (error instanceof OrganizationInputError) {
    return error.message;
  }
  if (isApiError(error)) {
    return safeApiMessage(error.status, error.code);
  }
  return fallback;
}

export function isOrganizationApiError(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}

export function isObsoleteReviewTargetError(error: unknown): boolean {
  if (!isApiError(error) || typeof error.code !== 'string') {
    return false;
  }
  return new Set([
    'ORGANIZATION_QUOTA_REQUEST_MEMBER_INELIGIBLE',
    'ORGANIZATION_QUOTA_REQUEST_NOT_PENDING',
    'ORGANIZATION_QUOTA_REQUEST_NOT_FOUND',
  ]).has(error.code);
}
