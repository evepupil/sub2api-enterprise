import { describe, expect, it } from 'vitest';

import { visibleNav } from '@/components/console/shell/nav-items';
import type { AffiliateDetail } from '@/lib/console/live/invite-types';
import { inviteesTruncated, inviteLink, rebatedInviteeCount } from '@/lib/console/live/invite-view';
import {
  toAffiliateDetail,
  toAffiliateTransfer,
  transferErrorFor,
} from '@/lib/server/sub2api/affiliate';
import { backendError } from '@/lib/server/sub2api/envelope';

const RAW_DETAIL = {
  user_id: 2,
  aff_code: 'U47FHLDJ5VTG',
  aff_count: 3,
  aff_quota: 1.5,
  aff_frozen_quota: 0.5,
  aff_history_quota: 2,
  effective_rebate_rate_percent: 12.5,
  invitees: [
    {
      user_id: 41,
      email: 'z***@example.com',
      username: 'zoe',
      created_at: '2026-10-04T10:00:00+08:00',
      total_rebate: 2,
    },
    { user_id: 42, email: '', username: 'neo', total_rebate: 0 },
    { email: 'broken@example.com' },
  ],
};

describe('邀请页：后端结果的转换', () => {
  it('详情换成页面用的形状，认不出的被邀请人整行丢掉', () => {
    expect(toAffiliateDetail(RAW_DETAIL)).toEqual({
      code: 'U47FHLDJ5VTG',
      ratePercent: 12.5,
      invited: 3,
      availableUsd: 1.5,
      frozenUsd: 0.5,
      totalUsd: 2,
      invitees: [
        {
          id: '41',
          email: 'z***@example.com',
          username: 'zoe',
          joinedAt: Date.parse('2026-10-04T02:00:00Z'),
          rebateUsd: 2,
        },
        { id: '42', email: '', username: 'neo', joinedAt: null, rebateUsd: 0 },
      ],
    });
  });

  it('缺邀请码或任何一个金额、人数都当取不到', () => {
    expect(toAffiliateDetail({ ...RAW_DETAIL, aff_code: '' })).toBeNull();
    expect(toAffiliateDetail({ ...RAW_DETAIL, aff_quota: null })).toBeNull();
    expect(toAffiliateDetail({ ...RAW_DETAIL, invitees: undefined })?.invitees).toEqual([]);
    expect(toAffiliateDetail('x')).toBeNull();
  });

  it('转入结果与错误归类', () => {
    expect(toAffiliateTransfer({ transferred_quota: 1.5, balance: 135.7 })).toEqual({
      transferredUsd: 1.5,
      balanceUsd: 135.7,
    });
    expect(toAffiliateTransfer({ transferred_quota: 1.5 })).toBeNull();
    expect(transferErrorFor(backendError(400, 'AFFILIATE_QUOTA_EMPTY'))).toBe('empty');
    expect(transferErrorFor(backendError(429, ''))).toBe('too_many');
    expect(transferErrorFor(backendError(503, 'SERVICE_UNAVAILABLE'))).toBe('unavailable');
  });
});

describe('邀请页：链接与统计', () => {
  const detail = toAffiliateDetail(RAW_DETAIL) as AffiliateDetail;

  it('邀请链接指向本站注册页，英文界面带 /en，邀请码做网址转义', () => {
    expect(inviteLink('https://dev.chaosyn.com', 'zh', 'U47FHLDJ5VTG')).toBe(
      'https://dev.chaosyn.com/register?aff=U47FHLDJ5VTG',
    );
    expect(inviteLink('https://dev.chaosyn.com', 'en', 'VIP 2026')).toBe(
      'https://dev.chaosyn.com/en/register?aff=VIP%202026',
    );
  });

  it('已产生返利的人数从列表里数；总人数比列表多时算只显示了一部分', () => {
    expect(rebatedInviteeCount(detail)).toBe(1);
    expect(inviteesTruncated(detail)).toBe(true);
    expect(inviteesTruncated({ ...detail, invited: 2 })).toBe(false);
  });

  it('后台没开邀请返利或还没读到开关时，侧栏不显示「邀请」', () => {
    const keys = (enabled: boolean | null) => visibleNav(enabled).map((item) => item.key);
    expect(keys(true)).toContain('invite');
    expect(keys(false)).not.toContain('invite');
    expect(keys(null)).not.toContain('invite');
    expect(keys(false)).toHaveLength(keys(true).length - 1);
  });
});
