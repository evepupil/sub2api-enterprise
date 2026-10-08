import type { ConsoleAnnouncement } from './announcement-types';
import { asAnnouncements, asReadIds } from './announcements-view';
import { getPortalJson, sendPortalJson, type ActionResult, type FetchResult } from './loadable';

/** 浏览器端读公告、标已读（官网接口 /api/portal/console/announcements*）。 */

export function fetchAnnouncements(
  signal?: AbortSignal,
): Promise<FetchResult<ConsoleAnnouncement[]>> {
  return getPortalJson(
    '/api/portal/console/announcements',
    (body) => asAnnouncements(body.items),
    signal,
  );
}

/** 标为已读；失败时不提示（下次自动刷新会按后台的实际状态显示），登录失效时整页跳登录页 */
export function sendAnnouncementsRead(
  ids: readonly number[],
): Promise<ActionResult<number[], 'unavailable'>> {
  return sendPortalJson(
    '/api/portal/console/announcements/read',
    'POST',
    { ids },
    (payload) => asReadIds(payload.read),
    ['unavailable'],
    () => 'unavailable',
  );
}
