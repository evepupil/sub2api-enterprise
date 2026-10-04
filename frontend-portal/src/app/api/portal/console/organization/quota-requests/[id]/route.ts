import type { NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/server/session/session';
import {
  parseId,
  parseQuotaRequestAction,
  quotaRequestActionRequest,
  toQuotaRequest,
} from '@/lib/server/sub2api/organization';
import { orgWrite, strict } from '@/lib/server/sub2api/organization-route';

interface QuotaRequestRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 处理一条配额申请：POST { action, note? }。通过、驳回是组织管理员做的（可带备注），撤回是成员撤自己的。
 */
export async function POST(request: NextRequest, context: QuotaRequestRouteContext) {
  const id = parseId((await context.params).id);
  const input = parseQuotaRequestAction(await readJsonBody(request));
  return orgWrite(
    request,
    id !== null && input
      ? {
          scope: 'org quota request ' + input.action,
          method: 'POST',
          ...quotaRequestActionRequest(id, input.action, input.note),
          field: 'request',
          convert: strict(toQuotaRequest),
        }
      : null,
  );
}
