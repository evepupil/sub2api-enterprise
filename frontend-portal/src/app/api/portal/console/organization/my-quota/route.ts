import type { NextRequest } from 'next/server';

import { DASHBOARD_STATS_PATH, toMyOrgQuota } from '@/lib/server/sub2api/organization';
import { orgRead } from '@/lib/server/sub2api/organization-route';

/**
 * 普通成员自己的组织配额（用量页的「组织配额」卡片）：GET。
 * 后端放在用户仪表盘统计里，个人用户和组织管理员为 null（页面不显示卡片）。
 */
export async function GET(request: NextRequest) {
  return orgRead(request, {
    scope: 'org my quota',
    method: 'GET',
    path: DASHBOARD_STATS_PATH,
    field: 'quota',
    convert: (raw) => toMyOrgQuota(raw),
  });
}
