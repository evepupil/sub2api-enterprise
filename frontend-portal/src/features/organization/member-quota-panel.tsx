'use client';

/**
 * 普通成员概览的配额申请入口。
 *
 * 契约来源：design/team-and-delivery.md「成员申请弹窗」、
 * src/features/organization/types.ts、.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 只有「属于组织且不是所有者」的普通成员才挂载；其他身份返回 null，
 *   既不渲染入口也不发任何组织请求。
 * - 入口保持轻量，只负责打开弹窗；当前配额与申请历史由弹窗在打开后按需
 *   通过 usePortalQuery 读取，不在概览加载时为按钮多打一次请求。
 * - 不读取所有者专属的申请规则接口（request-policy 为 ownerOnly）。
 */

import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/auth-provider';
import { MemberRequestDialog } from './member-request-dialog';

export function MemberQuotaPanel() {
  const { status, user } = useAuth();
  const [open, setOpen] = useState(false);

  const isMember = user !== null && user.organization !== null && !user.organization.isOwner;

  if (status !== 'authenticated' || user === null || !isMember) {
    return null;
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        配额申请
      </Button>
      {/* 关闭即卸载：表单与提交结果不跨弹窗生命周期保留。 */}
      {open ? <MemberRequestDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
