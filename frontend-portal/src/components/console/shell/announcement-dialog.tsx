'use client';

import dynamic from 'next/dynamic';

import type { ConsoleAnnouncement } from '@/lib/console/live/announcement-types';
import { formatDateTimeShort } from '@/lib/console/time';

import { Dialog } from '../dialog';
import { Skeleton } from '../skeleton';

/** Markdown 显示组件只在打开公告时才下载，进控制台不多背这一块 */
const Markdown = dynamic(() => import('../markdown'), {
  loading: () => (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  ),
});

/**
 * 公告详情：标题、发布时间、正文（照后台写的格式显示）。打开即算已读（由铃铛菜单负责标）。
 * 关的时候内容先留着，关闭过程中不闪成空白。
 */
export function AnnouncementDialog({
  announcement,
  open,
  onOpenChange,
}: {
  announcement: ConsoleAnnouncement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const publishedAt = announcement?.publishedAt ?? null;
  return (
    <Dialog
      id="announcement"
      open={open && announcement !== null}
      onOpenChange={onOpenChange}
      size="lg"
      title={announcement?.title ?? ''}
      description={
        publishedAt === null ? undefined : (
          <time className="tabular-nums" dateTime={new Date(publishedAt).toISOString()}>
            {formatDateTimeShort(publishedAt)}
          </time>
        )
      }
    >
      {announcement && announcement.content.trim() !== '' ? (
        <Markdown>{announcement.content}</Markdown>
      ) : null}
    </Dialog>
  );
}

export default AnnouncementDialog;
