import type { NextRequest } from 'next/server';

import { ORG_PATH, toOrgSummary } from '@/lib/server/sub2api/organization';
import { orgRead, orNull } from '@/lib/server/sub2api/organization-route';

/** 当前账号的组织概况：GET。不在组织里时 organization 为 null */
export async function GET(request: NextRequest) {
  return orgRead(request, {
    scope: 'org summary',
    method: 'GET',
    path: ORG_PATH,
    field: 'organization',
    convert: orNull(toOrgSummary),
  });
}
