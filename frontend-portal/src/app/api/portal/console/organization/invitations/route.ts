import type { NextRequest } from 'next/server';

import { invitationExpiry } from '@/lib/console/live/org-rules';
import { readJsonBody } from '@/lib/server/session/session';
import {
  INVITATIONS_PATH,
  parseInvitationCreate,
  toInvitation,
  toInvitations,
} from '@/lib/server/sub2api/organization';
import { orgRead, orgWrite, strict } from '@/lib/server/sub2api/organization-route';

/** 组织邀请码列表（组织管理员）：GET */
export async function GET(request: NextRequest) {
  return orgRead(request, {
    scope: 'org invitations',
    method: 'GET',
    path: INVITATIONS_PATH,
    field: 'invitations',
    convert: strict(toInvitations),
  });
}

/** 创建邀请码（组织管理员）：POST { days }（1 / 7 / 30，0 是长期有效），到期时间按服务器的当前时间算 */
export async function POST(request: NextRequest) {
  const days = parseInvitationCreate(await readJsonBody(request));
  const expiresAt = days === null ? null : invitationExpiry(days, Date.now());
  return orgWrite(
    request,
    days === null
      ? null
      : {
          scope: 'org invitation create',
          method: 'POST',
          path: INVITATIONS_PATH,
          body: expiresAt === null ? {} : { expires_at: expiresAt },
          field: 'invitation',
          convert: strict(toInvitation),
        },
  );
}
