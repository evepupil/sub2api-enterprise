/**
 * M4 独立组织错误边界测试。
 *
 * 契约来源：.fleet/briefs/m45-regression-tests.md 第 5 条、src/features/organization/errors.ts、
 * src/features/auth/api-error.ts。
 * 只覆盖错误展示边界，不写主题/布局等纯展示单测。
 *
 * 业务事实（任务书）：
 * - 只有本地表单输入错误（OrganizationInputError）与 ApiError 的安全文案可以展示给用户。
 * - ApiError 必须按 code/status 本地映射，不信任构造时传入的任意 message。
 * - 普通中文 Error 即使含字段路径、原始响应或英文，也不得直接透出，只能退回兜底文案。
 */

import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/features/auth/api-error';
import {
  OrganizationInputError,
  isOrganizationApiError,
  organizationErrorText,
} from '../src/features/organization/errors';

const FALLBACK = '组织操作失败，请稍后重试';

describe('organizationErrorText：本地输入错误原样展示', () => {
  it('OrganizationInputError 的中文提示直接展示', () => {
    expect(
      organizationErrorText(
        new OrganizationInputError('周期天数必须是 1 到 3650 的整数'),
        FALLBACK,
      ),
    ).toBe('周期天数必须是 1 到 3650 的整数');
  });

  it('OrganizationInputError 的 name 为 OrganizationInputError，便于区分', () => {
    const error = new OrganizationInputError('金额不能为空');
    expect(error.name).toBe('OrganizationInputError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('organizationErrorText：ApiError 按 code/status 本地映射', () => {
  it('业务 code 映射成本地文案，忽略构造时任意 message', () => {
    const error = new ApiError(
      400,
      'ORGANIZATION_MEMBER_NOT_FOUND',
      'raw: member 999 not found in org 5 (internal)',
    );
    expect(organizationErrorText(error, FALLBACK)).toBe('该成员不存在或已不属于当前组织');
  });

  it('无业务 code 时按 status 映射，不泄露原始 message', () => {
    const error = new ApiError(500, null, 'upstream panic: sql: no rows in result set');
    expect(organizationErrorText(error, FALLBACK)).toBe('服务暂时不可用，请稍后重试');
    expect(organizationErrorText(error, FALLBACK)).not.toContain('panic');
  });

  it('status=0 映射网络失败文案', () => {
    expect(organizationErrorText(new ApiError(0, null, 'fetch failed'), FALLBACK)).toBe(
      '网络连接失败，请稍后重试',
    );
  });

  it('未知 code/status 仍退回安全兜底，不透出构造 message', () => {
    const error = new ApiError(418, 'SOME_UNKNOWN_CODE', 'teapot 字段 member[0].password');
    const text = organizationErrorText(error, FALLBACK);
    expect(text).not.toContain('teapot');
    expect(text).not.toContain('password');
    expect(text.length).toBeGreaterThan(0);
  });

  it('配额申请相关 code 映射成本地文案', () => {
    expect(
      organizationErrorText(
        new ApiError(409, 'ORGANIZATION_QUOTA_REQUEST_NOT_PENDING', 'x'),
        FALLBACK,
      ),
    ).toBe('该申请已处理，请查看最新状态');
    expect(
      organizationErrorText(
        new ApiError(400, 'ORGANIZATION_QUOTA_REQUEST_MEMBER_INELIGIBLE', 'x'),
        FALLBACK,
      ),
    ).toBe('成员状态或额度已变化，请查看最新申请状态');
  });
});

describe('organizationErrorText：普通 Error 不直接透出', () => {
  it('含字段路径的中文 Error 退回兜底，不展示内部字段', () => {
    const error = new Error('组织数据字段不合法: member[0].spending_limit');
    const text = organizationErrorText(error, FALLBACK);
    expect(text).toBe(FALLBACK);
    expect(text).not.toContain('member[0]');
    expect(text).not.toContain('spending_limit');
  });

  it('含原始响应片段的中文 Error 退回兜底', () => {
    const error = new Error('请求失败: {"code":500,"message":"internal error","stack":"..."}');
    expect(organizationErrorText(error, FALLBACK)).toBe(FALLBACK);
  });

  it('纯英文 Error 退回兜底', () => {
    expect(organizationErrorText(new Error('TypeError: cannot read property'), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it('非 Error 值退回兜底', () => {
    expect(organizationErrorText(undefined, FALLBACK)).toBe(FALLBACK);
    expect(organizationErrorText(null, FALLBACK)).toBe(FALLBACK);
    expect(organizationErrorText('some string', FALLBACK)).toBe(FALLBACK);
    expect(organizationErrorText({ message: '组织数据不合法' }, FALLBACK)).toBe(FALLBACK);
  });
});

describe('isOrganizationApiError：按 code 精确判断', () => {
  it('匹配相同 code 的 ApiError', () => {
    const error = new ApiError(400, 'ORGANIZATION_MEMBER_NAME_INVALID', 'x');
    expect(isOrganizationApiError(error, 'ORGANIZATION_MEMBER_NAME_INVALID')).toBe(true);
    expect(isOrganizationApiError(error, 'ORGANIZATION_MEMBER_NOT_FOUND')).toBe(false);
  });

  it('普通 Error 或未知值不算 ApiError', () => {
    expect(isOrganizationApiError(new Error('x'), 'ORGANIZATION_MEMBER_NOT_FOUND')).toBe(false);
    expect(isOrganizationApiError(null, 'ORGANIZATION_MEMBER_NOT_FOUND')).toBe(false);
  });
});
