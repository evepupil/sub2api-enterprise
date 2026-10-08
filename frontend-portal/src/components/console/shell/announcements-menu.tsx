'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConsoleAnnouncement } from '@/lib/console/live/announcement-types';
import { unreadIds } from '@/lib/console/live/announcements-view';
import type { AnnouncementsState } from '@/lib/console/live/use-announcements';
import { formatDateTimeShort } from '@/lib/console/time';
import { cn } from '@/lib/utils';

import { buttonClass } from '../button';
import { Skeleton } from '../skeleton';
import { AnnouncementDialog } from './announcement-dialog';

/**
 * 铃铛：只放后台「公告管理」发给当前用户的公告（2026-10-08 用户定，别的不放）。
 * 有没读的公告时右上角一个红点；菜单列出 20 条（照后台的顺序：没读的在前、再按新到旧；没读的前面有红点），可「全部已读」；
 * 点一条打开详情并标为已读。还没读到时显示占位，第一次就读失败时显示「重试」，没有公告时写「暂无公告」。
 * 数据由控制台外壳读一次、传进来（侧栏、手机抽屉、手机顶栏的铃铛共用）。
 */
export function AnnouncementsMenu({
  announcements,
  side = 'top',
}: {
  announcements: AnnouncementsState;
  side?: 'top' | 'bottom';
}) {
  const t = useTranslations('console');
  const { status, items, unread, reload, markRead } = announcements;
  const [selected, setSelected] = useState<ConsoleAnnouncement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openAnnouncement = (item: ConsoleAnnouncement) => {
    setSelected(item);
    setDialogOpen(true);
    if (!item.read) markRead([item.id]);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-announcements
            data-unread={unread}
            aria-label={
              unread > 0
                ? t('announcements.labelUnread', { count: unread })
                : t('announcements.label')
            }
            className={buttonClass({
              variant: 'ghost',
              size: 'sm',
              className: 'relative size-9 px-0 text-muted-foreground hover:text-foreground',
            })}
          >
            <Bell aria-hidden className="size-4" />
            {unread > 0 ? (
              <span
                aria-hidden
                data-unread-dot
                className="absolute right-2 top-2 size-1.5 rounded-full bg-danger-graphic"
              />
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={side}
          align="start"
          collisionPadding={8}
          className="w-80 max-w-[calc(100vw-1rem)]"
        >
          <div className="flex items-center justify-between gap-2">
            <DropdownMenuLabel>{t('announcements.title')}</DropdownMenuLabel>
            {unread > 0 ? (
              <DropdownMenuItem
                data-announcements-read-all
                onSelect={(event) => {
                  event.preventDefault();
                  markRead(unreadIds(items));
                }}
                className="px-2 py-1 text-xs text-muted-foreground data-[highlighted]:text-foreground"
              >
                {t('announcements.markAllRead')}
              </DropdownMenuItem>
            ) : null}
          </div>

          {status === 'loading' ? (
            <div data-announcements-loading className="space-y-3 px-3 py-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : status === 'error' ? (
            <div data-announcements-error className="px-3 pb-1 pt-2">
              <p className="text-sm text-muted-foreground">{t('announcements.loadFailed')}</p>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  reload();
                }}
                className="-mx-3 mt-1 font-medium"
              >
                {t('announcements.retry')}
              </DropdownMenuItem>
            </div>
          ) : items.length === 0 ? (
            <p
              data-announcements-empty
              className="px-3 py-6 text-center text-sm text-muted-foreground"
            >
              {t('announcements.empty')}
            </p>
          ) : (
            <div className="max-h-[min(24rem,60dvh)] overflow-y-auto">
              {items.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  data-announcement={item.id}
                  data-read={item.read ? 'true' : 'false'}
                  onSelect={() => openAnnouncement(item)}
                  className="items-start"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.read ? 'bg-transparent' : 'bg-danger-graphic',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'line-clamp-2 break-words text-sm',
                        item.read ? 'text-muted-foreground' : 'font-medium text-foreground',
                      )}
                    >
                      {item.read ? null : (
                        <span className="sr-only">{t('announcements.unread')}</span>
                      )}
                      {item.title}
                    </span>
                    {item.publishedAt !== null ? (
                      <span className="block text-xs tabular-nums text-subtle-foreground">
                        {formatDateTimeShort(item.publishedAt)}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AnnouncementDialog announcement={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
