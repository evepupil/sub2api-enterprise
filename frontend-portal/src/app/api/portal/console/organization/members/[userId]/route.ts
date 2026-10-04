import type { NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/server/session/session';
import {
  memberUpdateRequest,
  parseId,
  parseMemberUpdate,
  toOrgMember,
} from '@/lib/server/sub2api/organization';
import { orgWrite, strict } from '@/lib/server/sub2api/organization-route';

interface MemberRouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * 改一个成员（组织管理员）：PATCH，请求体每次只改一项：
 * { kind: 'status', status } / { kind: 'name', displayName } / { kind: 'limit', spendingLimit } / { kind: 'quota', quota }。
 */
export async function PATCH(request: NextRequest, context: MemberRouteContext) {
  const userId = parseId((await context.params).userId);
  const update = parseMemberUpdate(await readJsonBody(request));
  return orgWrite(
    request,
    userId !== null && update
      ? {
          scope: 'org member update',
          method: 'PUT',
          ...memberUpdateRequest(userId, update),
          field: 'member',
          convert: strict(toOrgMember),
        }
      : null,
  );
}
