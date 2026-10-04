import type { NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/server/session/session';
import {
  parsePolicyInput,
  POLICY_PATH,
  policyPayload,
  toPolicy,
} from '@/lib/server/sub2api/organization';
import { orgRead, orgWrite, strict } from '@/lib/server/sub2api/organization-route';

/** 配额申请策略（组织管理员）：GET */
export async function GET(request: NextRequest) {
  return orgRead(request, {
    scope: 'org quota request policy',
    method: 'GET',
    path: POLICY_PATH,
    field: 'policy',
    convert: strict(toPolicy),
  });
}

/** 修改申请策略：PUT { mode, minAmount, maxAmount } */
export async function PUT(request: NextRequest) {
  const policy = parsePolicyInput(await readJsonBody(request));
  return orgWrite(
    request,
    policy && {
      scope: 'org quota request policy save',
      method: 'PUT',
      path: POLICY_PATH,
      body: policyPayload(policy),
      field: 'policy',
      convert: strict(toPolicy),
    },
  );
}
