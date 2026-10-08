import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConsoleAnnouncement } from '@/lib/console/live/announcement-types';
import {
  asAnnouncements,
  asReadIds,
  unreadCount,
  unreadIds,
  withRead,
} from '@/lib/console/live/announcements-view';
import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';
import { parseReadIds, toAnnouncements } from '@/lib/server/sub2api/announcements';

/** 假的后端：记下每次调用，按「方法 路径」给结果 */
const backend = vi.hoisted(() => ({
  calls: [] as { method: string; path: string }[],
  respond: (() => ({ ok: true, data: null })) as (
    method: string,
    path: string,
  ) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push({ method: call.method, path: call.path });
    return backend.respond(call.method, call.path);
  },
}));

const listRoute = await import('@/app/api/portal/console/announcements/route');
const readRoute = await import('@/app/api/portal/console/announcements/read/route');

const ORIGIN = 'http://portal.test';

function request(
  method: 'GET' | 'POST',
  init: { body?: unknown; cookie?: string; origin?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    host: 'portal.test',
    cookie: init.cookie ?? 'portal_at=token-1; portal_rt=refresh-1',
    origin: init.origin ?? ORIGIN,
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`${ORIGIN}/api/portal/console/announcements`, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const fail = (status: number, reason = ''): BackendResult<unknown> => ({
  ok: false,
  error: { status, reason, message: '' },
});

/** 后端公告接口给的一条（字段同 sub2api 的用户公告） */
const raw = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `公告 ${id}`,
  content: `正文 ${id}`,
  notify_mode: 'silent',
  created_at: '2026-10-08T02:00:00Z',
  updated_at: '2026-10-08T02:00:00Z',
  ...extra,
});

const item = (id: number, read: boolean): ConsoleAnnouncement => ({
  id,
  title: `公告 ${id}`,
  content: '',
  publishedAt: null,
  read,
});

beforeEach(() => {
  backend.calls = [];
  backend.respond = () => ({ ok: true, data: null });
});

describe('整理后端给的公告', () => {
  it('有开始时间用开始时间，否则用创建时间；有读过的时间就算已读；没有正文按空', () => {
    expect(
      toAnnouncements([
        raw(3, { starts_at: '2026-10-09T00:00:00Z', read_at: '2026-10-09T01:00:00Z' }),
        raw(2, { content: undefined }),
      ]),
    ).toEqual([
      {
        id: 3,
        title: '公告 3',
        content: '正文 3',
        publishedAt: Date.parse('2026-10-09T00:00:00Z'),
        read: true,
      },
      {
        id: 2,
        title: '公告 2',
        content: '',
        publishedAt: Date.parse('2026-10-08T02:00:00Z'),
        read: false,
      },
    ]);
  });

  it('时间读不出来时为空；缺编号、编号不是正整数、缺标题的跳过；不是数组时为 null', () => {
    expect(toAnnouncements([raw(1, { created_at: 'oops' })])?.[0]?.publishedAt).toBeNull();
    expect(
      toAnnouncements([{ title: '没编号' }, raw(0), raw(1.5), { id: 4 }, raw(5)])?.map((a) => a.id),
    ).toEqual([5]);
    expect(toAnnouncements({ items: [] })).toBeNull();
    expect(toAnnouncements(null)).toBeNull();
    expect(toAnnouncements([])).toEqual([]);
  });

  it('最多 20 条，按后端给的顺序（没读的在前、再按新到旧）取前面的', () => {
    const many = Array.from({ length: 25 }, (_, index) => raw(100 - index));
    const out = toAnnouncements(many);
    expect(out).toHaveLength(20);
    expect(out?.[0]?.id).toBe(100);
    expect(out?.[19]?.id).toBe(81);
  });
});

describe('标为已读的请求内容', () => {
  it('1–20 个正整数编号，重复的去掉', () => {
    expect(parseReadIds({ ids: [3, 1, 3] })).toEqual([3, 1]);
    expect(parseReadIds({ ids: Array.from({ length: 20 }, (_, i) => i + 1) })).toHaveLength(20);
  });

  it('空的、超过 20 个、不是正整数、没给 ids 时不合法', () => {
    expect(parseReadIds({ ids: [] })).toBeNull();
    expect(parseReadIds({ ids: Array.from({ length: 21 }, (_, i) => i + 1) })).toBeNull();
    expect(parseReadIds({ ids: [1, 0] })).toBeNull();
    expect(parseReadIds({ ids: [1.5] })).toBeNull();
    expect(parseReadIds({ ids: ['1'] })).toBeNull();
    expect(parseReadIds({})).toBeNull();
    expect(parseReadIds(null)).toBeNull();
  });
});

describe('读公告的官网接口', () => {
  it('没登录回 401，不调后台', async () => {
    const response = await listRoute.GET(request('GET', { cookie: '' }));
    expect(response.status).toBe(401);
    expect(backend.calls).toEqual([]);
  });

  it('带着登录状态读后台的用户公告，回整理好的列表', async () => {
    backend.respond = () => ({ ok: true, data: [raw(7)] });
    const response = await listRoute.GET(request('GET'));
    expect(response.status).toBe(200);
    expect(backend.calls).toEqual([{ method: 'GET', path: '/announcements' }]);
    expect(await response.json()).toEqual({
      ok: true,
      items: [
        {
          id: 7,
          title: '公告 7',
          content: '正文 7',
          publishedAt: Date.parse('2026-10-08T02:00:00Z'),
          read: false,
        },
      ],
    });
  });

  it('后台出错回 503，后台给的不是列表回 502', async () => {
    backend.respond = () => fail(500);
    expect((await listRoute.GET(request('GET'))).status).toBe(503);
    backend.respond = () => ({ ok: true, data: { not: 'a list' } });
    expect((await listRoute.GET(request('GET'))).status).toBe(502);
  });
});

describe('标为已读的官网接口', () => {
  it('没登录回 401，别的网站发起的回 403，内容不合法回 400，都不调后台', async () => {
    expect((await readRoute.POST(request('POST', { cookie: '', body: { ids: [1] } }))).status).toBe(
      401,
    );
    expect(
      (await readRoute.POST(request('POST', { origin: 'https://evil.test', body: { ids: [1] } })))
        .status,
    ).toBe(403);
    expect((await readRoute.POST(request('POST', { body: { ids: [] } }))).status).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('浏览器发一次，官网服务器逐条转给后台，回标上的编号', async () => {
    const response = await readRoute.POST(request('POST', { body: { ids: [5, 6] } }));
    expect(response.status).toBe(200);
    expect(backend.calls).toEqual([
      { method: 'POST', path: '/announcements/5/read' },
      { method: 'POST', path: '/announcements/6/read' },
    ]);
    expect(await response.json()).toEqual({ ok: true, read: [5, 6] });
  });

  it('某一条刚被下线（后台说找不到）就跳过那一条', async () => {
    backend.respond = (_method, path) =>
      path.includes('/6/') ? fail(404) : { ok: true, data: null };
    const response = await readRoute.POST(request('POST', { body: { ids: [5, 6] } }));
    expect(await response.json()).toEqual({ ok: true, read: [5] });
  });

  it('一条都没标上且后台出错时回 503；登录失效且不能续期时回 401', async () => {
    backend.respond = () => fail(502);
    expect((await readRoute.POST(request('POST', { body: { ids: [5] } }))).status).toBe(503);
    backend.respond = () => fail(401);
    expect(
      (await readRoute.POST(request('POST', { cookie: 'portal_at=token-1', body: { ids: [5] } })))
        .status,
    ).toBe(401);
  });
});

describe('铃铛里的未读', () => {
  const items = [item(3, false), item(2, true), item(1, false)];

  it('数未读、列出未读的编号', () => {
    expect(unreadCount(items)).toBe(2);
    expect(unreadIds(items)).toEqual([3, 1]);
    expect(unreadCount([])).toBe(0);
  });

  it('这次已经标过的按已读显示，其余不动，原列表不改', () => {
    const shown = withRead(items, new Set([3]));
    expect(shown.map((a) => a.read)).toEqual([true, true, false]);
    expect(items[0]?.read).toBe(false);
    expect(shown[1]).toBe(items[1]);
  });

  it('官网接口的数据形状不对时按读取失败处理', () => {
    expect(asAnnouncements([item(1, false)])).toEqual([item(1, false)]);
    expect(asAnnouncements([{ ...item(1, false), read: 'no' }])).toBeNull();
    expect(asAnnouncements({})).toBeNull();
    expect(asReadIds([1, 2])).toEqual([1, 2]);
    expect(asReadIds(['1'])).toBeNull();
  });
});
