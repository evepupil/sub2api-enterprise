import {
  ANNOUNCEMENT_LIMIT,
  type ConsoleAnnouncement,
} from '@/lib/console/live/announcement-types';

import { callBackend } from './client';
import type { BackendResult } from './envelope';

/**
 * 控制台公告的后端接口：读发给当前用户的公告、标记已读（sub2api 原有的用户公告接口，后端不改）。
 * 整理和校验是纯函数，单测锁住。
 */

export const ANNOUNCEMENTS_PATH = '/announcements';

export const announcementReadPath = (id: number): string => `/announcements/${id}/read`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositiveId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** ISO 时间 → 毫秒；空或读不出来时 null */
function timeOf(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function toAnnouncement(raw: unknown): ConsoleAnnouncement | null {
  if (!isRecord(raw) || !isPositiveId(raw.id) || typeof raw.title !== 'string') return null;
  return {
    id: raw.id,
    title: raw.title,
    content: typeof raw.content === 'string' ? raw.content : '',
    publishedAt: timeOf(raw.starts_at) ?? timeOf(raw.created_at),
    read: timeOf(raw.read_at) !== null,
  };
}

/**
 * 后端 data（公告数组，没读的在前、再按新到旧）→ 铃铛用的列表，按原顺序最多 20 条；
 * 缺编号或标题的条目跳过；不是数组时 null
 */
export function toAnnouncements(raw: unknown): ConsoleAnnouncement[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ConsoleAnnouncement[] = [];
  for (const item of raw) {
    const announcement = toAnnouncement(item);
    if (announcement) out.push(announcement);
    if (out.length === ANNOUNCEMENT_LIMIT) break;
  }
  return out;
}

/** 标记已读的请求体 { ids: [...] }：1–20 个正整数编号，去重；不合法时 null */
export function parseReadIds(body: unknown): number[] | null {
  if (!isRecord(body) || !Array.isArray(body.ids)) return null;
  const ids = [...new Set(body.ids)];
  if (ids.length === 0 || ids.length > ANNOUNCEMENT_LIMIT || !ids.every(isPositiveId)) {
    return null;
  }
  return ids;
}

/**
 * 用同一个访问凭证把几条公告逐条标为已读（后端没有批量接口；同一条标多次没关系）。
 * 有一条遇到凭证失效就整体按凭证失效返回，交给登录续期后重来；
 * 别的失败（比如公告刚被下线）跳过那一条；一条都没标上且后端出错时按后端出错返回。
 * 成功时给出标上的编号。
 */
export async function markAnnouncementsRead(
  ids: readonly number[],
  accessToken: string,
  forwarded: Headers,
): Promise<BackendResult<number[]>> {
  const results = await Promise.all(
    ids.map((id) =>
      callBackend<unknown>({
        method: 'POST',
        path: announcementReadPath(id),
        accessToken,
        forwarded,
      }),
    ),
  );
  const errors = results.flatMap((result) => (result.ok ? [] : [result.error]));
  const expired = errors.find((error) => error.status === 401);
  if (expired) return { ok: false, error: expired };

  const read = ids.filter((_, index) => results[index]?.ok === true);
  const serverError = errors.find((error) => error.status >= 500);
  if (read.length === 0 && serverError) return { ok: false, error: serverError };
  return { ok: true, data: read };
}
