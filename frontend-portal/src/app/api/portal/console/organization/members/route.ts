import type { NextRequest } from 'next/server';

import {
  membersListPath,
  parseMembersQuery,
  toMembersPage,
} from '@/lib/server/sub2api/organization';
import { orgRead, strict } from '@/lib/server/sub2api/organization-route';

/** 成员列表（组织管理员）：GET ?page&pageSize&search&status，后端分页 */
export async function GET(request: NextRequest) {
  const query = parseMembersQuery(request.nextUrl.searchParams);
  return orgRead(
    request,
    query && {
      scope: 'org members',
      method: 'GET',
      path: membersListPath(query),
      field: 'data',
      convert: strict(toMembersPage),
    },
  );
}
