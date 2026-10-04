import type { NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/server/session/session';
import { memberBatchRequest, parseMemberBatch, toMembers } from '@/lib/server/sub2api/organization';
import { orgWrite } from '@/lib/server/sub2api/organization-route';

/** 勾选多个成员后的批量操作（组织管理员）：POST { kind: 'split' | 'quota', userIds, ... } */
export async function POST(request: NextRequest) {
  const batch = parseMemberBatch(await readJsonBody(request));
  return orgWrite(
    request,
    batch && {
      scope: 'org member batch',
      method: 'POST',
      ...memberBatchRequest(batch),
      field: 'members',
      convert: (raw) => (Array.isArray(raw) ? toMembers(raw) : undefined),
    },
  );
}
