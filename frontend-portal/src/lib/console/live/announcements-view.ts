import type { ConsoleAnnouncement } from './announcement-types';

/**
 * 控制台铃铛里公告的纯计算：数未读、把这次打开控制台后点过的当作已读、确认官网接口给的数据形状。单测锁住。
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 还没读的条数（铃铛红点、「全部已读」按钮看它） */
export function unreadCount(items: readonly ConsoleAnnouncement[]): number {
  return items.reduce((count, item) => (item.read ? count : count + 1), 0);
}

/** 还没读的那几条的编号（「全部已读」一次标完） */
export function unreadIds(items: readonly ConsoleAnnouncement[]): number[] {
  return items.filter((item) => !item.read).map((item) => item.id);
}

/**
 * 这次打开控制台后已经标过已读的几条，就算后台还没回、或者自动刷新时后台回的还是旧状态，也按已读显示，
 * 免得红点闪回来。
 */
export function withRead(
  items: readonly ConsoleAnnouncement[],
  readIds: ReadonlySet<number>,
): ConsoleAnnouncement[] {
  return items.map((item) => (item.read || !readIds.has(item.id) ? item : { ...item, read: true }));
}

function isAnnouncement(value: unknown): value is ConsoleAnnouncement {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    (value.publishedAt === null || typeof value.publishedAt === 'number') &&
    typeof value.read === 'boolean'
  );
}

/** 官网接口给的公告列表；形状不对时 null（按读取失败处理） */
export function asAnnouncements(value: unknown): ConsoleAnnouncement[] | null {
  return Array.isArray(value) && value.every(isAnnouncement) ? value : null;
}

/** 标为已读后官网接口回的编号列表；形状不对时 null */
export function asReadIds(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((id) => typeof id === 'number') ? value : null;
}
