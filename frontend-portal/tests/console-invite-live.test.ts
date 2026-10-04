import { describe, expect, it } from 'vitest';

import { visibleNav } from '@/components/console/shell/nav-items';
import type { AffiliateDetail } from '@/lib/console/live/invite-types';
import {
  freezePeriod,
  inviteesTruncated,
  inviteLink,
  rebatedInviteeCount,
} from '@/lib/console/live/invite-view';
import { toAffiliateDetail } from '@/lib/server/sub2api/affiliate';

const RAW_DETAIL = {
  user_id: 2,
  aff_code: 'U47FHLDJ5VTG',
  aff_count: 3,
  aff_quota: 0.25,
  aff_frozen_quota: 0.5,
  aff_history_quota: 2,
  effective_rebate_rate_percent: 12.5,
  rebate_freeze_hours: 72,
  rebate_duration_days: 30,
  rebate_per_invitee_cap: 50,
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
  it('详情换成页面用的形状：规则带后台设置，可转的和冻结中的都算待到账，认不出的被邀请人整行丢掉', () => {
    expect(toAffiliateDetail(RAW_DETAIL)).toEqual({
      code: 'U47FHLDJ5VTG',
      rules: { ratePercent: 12.5, freezeHours: 72, durationDays: 30, perInviteeCapUsd: 50 },
      invited: 3,
      totalUsd: 2,
      pendingUsd: 0.75,
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

  it('旧版后端没带规则设置、或设置不合法时按不冻结、永久有效、不设上限', () => {
    const legacy: Record<string, unknown> = { ...RAW_DETAIL };
    delete legacy.rebate_freeze_hours;
    delete legacy.rebate_duration_days;
    delete legacy.rebate_per_invitee_cap;
    expect(toAffiliateDetail(legacy)?.rules).toEqual({
      ratePercent: 12.5,
      freezeHours: 0,
      durationDays: 0,
      perInviteeCapUsd: 0,
    });
    expect(toAffiliateDetail({ ...RAW_DETAIL, rebate_freeze_hours: -5 })?.rules.freezeHours).toBe(
      0,
    );
  });

  it('缺邀请码或任何一个金额、人数、比例都当取不到', () => {
    expect(toAffiliateDetail({ ...RAW_DETAIL, aff_code: '' })).toBeNull();
    expect(toAffiliateDetail({ ...RAW_DETAIL, aff_quota: null })).toBeNull();
    expect(toAffiliateDetail({ ...RAW_DETAIL, effective_rebate_rate_percent: 'x' })).toBeNull();
    expect(toAffiliateDetail({ ...RAW_DETAIL, invitees: undefined })?.invitees).toEqual([]);
    expect(toAffiliateDetail('x')).toBeNull();
  });
});

describe('邀请页：链接、统计与规则写法', () => {
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

  it('冻结期整天数写天，否则写小时', () => {
    expect(freezePeriod(72)).toEqual({ unit: 'days', count: 3 });
    expect(freezePeriod(24)).toEqual({ unit: 'days', count: 1 });
    expect(freezePeriod(36)).toEqual({ unit: 'hours', count: 36 });
  });

  it('后台没开邀请返利或还没读到开关时，侧栏不显示「邀请」', () => {
    const keys = (enabled: boolean | null) => visibleNav(enabled).map((item) => item.key);
    expect(keys(true)).toContain('invite');
    expect(keys(false)).not.toContain('invite');
    expect(keys(null)).not.toContain('invite');
    expect(keys(false)).toHaveLength(keys(true).length - 1);
  });
});
