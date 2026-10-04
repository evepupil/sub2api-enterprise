import type { NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/server/session/session';
import {
  parseQuotaRequestsQuery,
  parseQuotaRequestSubmit,
  QUOTA_REQUESTS_PATH,
  quotaRequestsListPath,
  toQuotaRequest,
  toQuotaRequestsPage,
} from '@/lib/server/sub2api/organization';
import { orgRead, orgWrite, strict } from '@/lib/server/sub2api/organization-route';

/** 配额申请列表：GET ?page&pageSize&status。组织管理员看本组织的，普通成员只看自己的（后端分） */
export async function GET(request: NextRequest) {
  const query = parseQuotaRequestsQuery(request.nextUrl.searchParams);
  return orgRead(
    request,
    query && {
      scope: 'org quota requests',
      method: 'GET',
      path: quotaRequestsListPath(query),
      field: 'data',
      convert: strict(toQuotaRequestsPage),
    },
  );
}

/** 普通成员提交配额申请：POST { amount, reason? } */
export async function POST(request: NextRequest) {
  const submit = parseQuotaRequestSubmit(await readJsonBody(request));
  return orgWrite(
    request,
    submit && {
      scope: 'org quota request submit',
      method: 'POST',
      path: QUOTA_REQUESTS_PATH,
      body: submit.reason
        ? { amount: submit.amount, reason: submit.reason }
        : { amount: submit.amount },
      field: 'request',
      convert: strict(toQuotaRequest),
    },
  );
}
