'use client';

import { useState } from 'react';

import { DEFAULT_PAGE_SIZE } from '@/lib/console/pagination';
import { useLoadable, type FetchResult } from '@/lib/console/live/loadable';
import {
  fetchInvitations,
  fetchMembers,
  fetchPolicy,
  fetchQuotaRequests,
} from '@/lib/console/live/org-client';
import type { InvitationValidity } from '@/lib/console/live/org-rules';
import type {
  OrgInvitation,
  OrgMember,
  OrgMemberStatusFilter,
  OrgMembersPage,
  OrgMembersQuery,
  QuotaRequestPolicy,
  QuotaRequestsPage,
  QuotaRequestStatusFilter,
} from '@/lib/console/live/org-types';
import { useDebouncedValue } from '@/lib/console/live/use-debounced-value';

/**
 * 组织页三块数据各自的状态：成员（搜索、筛选、分页、勾选）、配额申请（申请设置、筛选、分页）、
 * 邀请码（有效期、列表）。reloadKey 是整页的「刷新」，各块自己的 version 是改动成功后的重读。
 */

/** 搜索框停下这么久才去查 */
const SEARCH_DEBOUNCE_MS = 300;
/** 配额申请区的默认每页条数（放在页面上方，少一点） */
const REQUESTS_PAGE_SIZE = 10;

/** 一组编号的开关集合（勾选、正在提交的行） */
function toggled(current: ReadonlySet<number>, id: number, on: boolean): ReadonlySet<number> {
  const next = new Set(current);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export function useBusyIds() {
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());
  const mark = (id: number, on: boolean) => setBusy((current) => toggled(current, id, on));
  return { busy, mark };
}

export function useOrgMembers(reloadKey: number) {
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<OrgMemberStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [version, setVersion] = useState(0);
  // 勾选跨页保留：记成员本身，平分上限的预览要写名字
  const [selected, setSelected] = useState<ReadonlyMap<number, OrgMember>>(() => new Map());
  const { busy, mark } = useBusyIds();

  const query: OrgMembersQuery = { page, pageSize, search, status };
  const list = useLoadable<OrgMembersPage>(
    `${JSON.stringify(query)}|${reloadKey}|${version}`,
    (signal) => fetchMembers(query, signal),
  );

  return {
    list,
    searchText,
    onSearchText: (value: string) => {
      setSearchText(value);
      setPage(1);
    },
    status,
    onStatus: (value: OrgMemberStatusFilter) => {
      setStatus(value);
      setPage(1);
    },
    onPage: setPage,
    onPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    selected,
    selectedIds: new Set(selected.keys()) as ReadonlySet<number>,
    toggleSelect: (member: OrgMember) =>
      setSelected((current) => {
        const next = new Map(current);
        if (next.has(member.userId)) next.delete(member.userId);
        else next.set(member.userId, member);
        return next;
      }),
    /** 勾上或取消这一页的全部成员（组织管理员本人除外） */
    selectPage: (members: readonly OrgMember[], checked: boolean) =>
      setSelected((current) => {
        const next = new Map(current);
        for (const member of members) {
          if (checked) next.set(member.userId, member);
          else next.delete(member.userId);
        }
        return next;
      }),
    clearSelection: () => setSelected(new Map()),
    busy,
    mark,
    /** 改动成功后重读成员表 */
    refresh: () => setVersion((value) => value + 1),
  };
}

export function useOrgRequests(reloadKey: number) {
  const [status, setStatus] = useState<QuotaRequestStatusFilter>('pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(REQUESTS_PAGE_SIZE);
  const [version, setVersion] = useState(0);
  const [policyVersion, setPolicyVersion] = useState(0);
  const { busy, mark } = useBusyIds();

  const policy = useLoadable<QuotaRequestPolicy>(`policy|${reloadKey}|${policyVersion}`, (signal) =>
    fetchPolicy(signal),
  );
  const query = { page, pageSize, status };
  const list = useLoadable<QuotaRequestsPage>(
    `${JSON.stringify(query)}|${reloadKey}|${version}`,
    (signal) => fetchQuotaRequests(query, signal),
  );

  return {
    policy,
    list,
    status,
    onStatus: (value: QuotaRequestStatusFilter) => {
      setStatus(value);
      setPage(1);
    },
    onPage: setPage,
    onPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    busy,
    mark,
    refresh: () => setVersion((value) => value + 1),
    refreshPolicy: () => setPolicyVersion((value) => value + 1),
  };
}

/** 邀请码列表连同读取时的时间与本站地址（判断「已过期」、拼邀请链接用，都只在浏览器里取） */
export interface InvitationsSnapshot {
  items: OrgInvitation[];
  nowMs: number;
  origin: string;
}

async function loadInvitations(signal: AbortSignal): Promise<FetchResult<InvitationsSnapshot>> {
  const result = await fetchInvitations(signal);
  if (result.kind !== 'ok') return result;
  return {
    kind: 'ok',
    data: { items: result.data, nowMs: Date.now(), origin: window.location.origin },
  };
}

export function useOrgInvitations(reloadKey: number) {
  const [validity, setValidity] = useState<InvitationValidity>(7);
  const [version, setVersion] = useState(0);
  const { busy, mark } = useBusyIds();
  const list = useLoadable<InvitationsSnapshot>(
    `invitations|${reloadKey}|${version}`,
    loadInvitations,
  );
  return {
    list,
    validity,
    onValidity: setValidity,
    busy,
    mark,
    refresh: () => setVersion((value) => value + 1),
  };
}
