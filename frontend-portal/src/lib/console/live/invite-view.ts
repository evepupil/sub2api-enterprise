import type { AffiliateDetail } from './invite-types';

/**
 * 邀请页（接后端）的纯计算：邀请链接、已产生返利的人数。单测锁住。
 */

/**
 * 邀请链接：本站的注册页带上邀请码（和 sub2api 原来的 /register?aff= 一样，官网注册页会自动填好）。
 * 英文界面下链接也指向英文注册页。
 */
export function inviteLink(origin: string, locale: 'zh' | 'en', code: string): string {
  const prefix = locale === 'en' ? '/en' : '';
  return `${origin}${prefix}/register?aff=${encodeURIComponent(code)}`;
}

/** 已经给你带来过返利的被邀请人数（只能从后端给的最近 100 人里数） */
export function rebatedInviteeCount(detail: AffiliateDetail): number {
  return detail.invitees.filter((invitee) => invitee.rebateUsd > 0).length;
}

/** 后端只给最近 100 个被邀请人；总人数更多时邀请记录只是其中一部分 */
export function inviteesTruncated(detail: AffiliateDetail): boolean {
  return detail.invited > detail.invitees.length;
}
