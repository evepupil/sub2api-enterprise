import type { NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/server/session/session';
import {
  DEFAULT_QUOTA_PATH,
  defaultQuotaPayload,
  parseDefaultQuotaInput,
  toDefaultQuota,
  toDefaultQuotaResult,
} from '@/lib/server/sub2api/organization';
import { orgRead, orgWrite, strict } from '@/lib/server/sub2api/organization-route';

/** 新成员默认配额（组织管理员）：GET */
export async function GET(request: NextRequest) {
  return orgRead(request, {
    scope: 'org default quota',
    method: 'GET',
    path: DEFAULT_QUOTA_PATH,
    field: 'defaultQuota',
    convert: strict(toDefaultQuota),
  });
}

/** 开启、修改或关闭新成员默认配额：PUT { enabled, amount, periodDays, syncUnconfigured, syncConfigured } */
export async function PUT(request: NextRequest) {
  const input = parseDefaultQuotaInput(await readJsonBody(request));
  return orgWrite(
    request,
    input && {
      scope: 'org default quota save',
      method: 'PUT',
      path: DEFAULT_QUOTA_PATH,
      body: defaultQuotaPayload(input),
      field: 'result',
      convert: strict(toDefaultQuotaResult),
    },
  );
}
