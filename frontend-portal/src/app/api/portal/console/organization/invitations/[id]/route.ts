import type { NextRequest } from 'next/server';

import { invitationPath, parseId } from '@/lib/server/sub2api/organization';
import { orgWrite } from '@/lib/server/sub2api/organization-route';

interface InvitationRouteContext {
  params: Promise<{ id: string }>;
}

/** 停用邀请码（组织管理员）：DELETE */
export async function DELETE(request: NextRequest, context: InvitationRouteContext) {
  const id = parseId((await context.params).id);
  return orgWrite(
    request,
    id === null
      ? null
      : {
          scope: 'org invitation disable',
          method: 'DELETE',
          path: invitationPath(id),
          field: 'done',
          convert: () => true,
        },
  );
}
