/**
 * 配额申请的纯校验与载荷构造（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/organization/types.ts（主控冻结）与
 * ../.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 金额只接受正数、有限、十进制最多 8 位小数；空串、0、负数、指数、千分位一律抛错，
 *   绝不静默取 0。
 * - reason / 审批备注 trim 后按 Unicode 码点计最多 500，超长抛错而不是悄悄截断。
 * - 传入成员配额概况时，只有后端明确 can_request=true 且没有 pending 才允许提交；
 *   auto 模式不在本地伪造发放，是否已发放只以后端返回的 status=granted 为准。
 * - 申请 id 必须是正的安全整数，避免把任意字符串拼进路径。
 */

import { OrganizationInputError } from './errors';
import type { MemberQuotaInfo, PolicyDraft, QuotaRequestRecord } from './types';

/** 金额文本：整数部分至少一位，小数最多 8 位，不接受符号与指数。 */
const DECIMAL_PATTERN = /^[0-9]+(?:\.[0-9]{1,8})?$/;
/** 理由与审批备注的 Unicode 码点上限，与后端 QuotaRequestReasonMaxLen 一致。 */
const MAX_TEXT_POINTS = 500;

/** 申请 id：正的安全整数。 */
function requireRequestId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new OrganizationInputError('配额申请编号不正确');
  }
  return id;
}

/** 金额文本转数字：正数、有限、最多 8 位小数。 */
function parsePositiveAmount(value: string): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') {
    throw new OrganizationInputError('请输入申请金额');
  }
  if (!DECIMAL_PATTERN.test(text)) {
    throw new OrganizationInputError('金额必须是正数且不超过 8 位小数');
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new OrganizationInputError('金额必须大于 0');
  }
  return parsed;
}

/** 理由/备注：trim 后最多 500 个 Unicode 码点，超长直接拒绝。 */
function parseBoundedText(value: string, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (Array.from(text).length > MAX_TEXT_POINTS) {
    throw new OrganizationInputError(`${field}不能超过 ${MAX_TEXT_POINTS} 个字`);
  }
  return text;
}

/**
 * 构造申请策略请求体。
 * off 关闭时 min/max 一律提交 null（清空残留数字）；
 * approve/auto 时必须给出正数区间且 max >= min。
 */
export function buildPolicyPayload(draft: PolicyDraft): Record<string, unknown> {
  if (draft.mode === 'off') {
    return { mode: 'off', min_amount: null, max_amount: null };
  }
  if (draft.mode !== 'approve' && draft.mode !== 'auto') {
    throw new OrganizationInputError('申请方式不正确');
  }
  const minAmount = parsePositiveAmount(draft.minAmount);
  const maxAmount = parsePositiveAmount(draft.maxAmount);
  if (maxAmount < minAmount) {
    throw new OrganizationInputError('最大金额不能小于最小金额');
  }
  return { mode: draft.mode, min_amount: minAmount, max_amount: maxAmount };
}

/**
 * 构造提交申请的请求体。
 * 传入 quota 时先按后端概况判断资格：不可申请、已有待处理申请、
 * 或金额超出策略区间都直接拒绝，不把注定失败的请求发出去。
 */
export function buildQuotaRequestPayload(
  input: { amount: string; reason: string },
  quota?: MemberQuotaInfo,
): { amount: number; reason: string } {
  const amount = parsePositiveAmount(input.amount);
  const reason = parseBoundedText(input.reason, '申请理由');

  if (quota !== undefined) {
    if (!quota.canRequest) {
      throw new OrganizationInputError('当前不能提交配额申请');
    }
    if (quota.pendingExists) {
      throw new OrganizationInputError('已有待处理的配额申请，请等待审批结果');
    }
    if (quota.minAmount !== null && amount < quota.minAmount) {
      throw new OrganizationInputError(`申请金额不能低于 ${quota.minAmount}`);
    }
    if (quota.maxAmount !== null && amount > quota.maxAmount) {
      throw new OrganizationInputError(`申请金额不能高于 ${quota.maxAmount}`);
    }
  }

  return { amount, reason };
}

/** 审批备注：trim 后最多 500 个 Unicode 码点，可为空串。 */
export function reviewNote(value: string): string {
  return parseBoundedText(value, '审批说明');
}

/** 只有 pending 的申请可以审批；未知状态不算可审批。 */
export function canReviewRequest(record: QuotaRequestRecord): boolean {
  return record.status === 'pending';
}

/** 只有 pending 且属于本人的申请可以撤回。 */
export function canWithdrawRequest(record: QuotaRequestRecord, userId: number): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return false;
  }
  return record.status === 'pending' && record.userId === userId;
}

/** 申请 id 校验入口，供 request-api 拼路径前调用。 */
export function assertRequestId(id: number): number {
  return requireRequestId(id);
}
