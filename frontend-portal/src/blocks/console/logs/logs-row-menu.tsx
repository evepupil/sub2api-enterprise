'use client';

import { Check, Copy, EllipsisVertical, Eye, Terminal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { useCopy } from '@/components/console/copy-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { LogRow } from '@/lib/console/live/logs-types';
import { curlExample } from '@/lib/console/live/logs-view';

import type { OpenLogDetail } from './logs-types';

const ICON = 'size-4 text-subtle-foreground';

/**
 * 每行最右边的「更多操作」菜单：复制请求 ID（后端记了才有）、复制为 curl（示意请求）、查看详情。
 * 复制成功后菜单保持打开，对应菜单项的文字短暂变成「已复制」（1.5 秒后恢复），让用户看到结果。
 * 菜单用非模态：从菜单里打开详情抽屉时，不会和抽屉的遮罩抢页面的点击控制。
 */
export function LogsRowMenu({ log, onOpenDetail }: { log: LogRow; onOpenDetail: OpenLogDetail }) {
  const t = useTranslations('consoleLogs');
  const { copiedKey, copy } = useCopy();
  const copiedId = copiedKey === 'id';
  const copiedCurl = copiedKey === 'curl';
  // 菜单项点完就消失了，抽屉关闭后焦点要还给这个常驻的「更多操作」按钮
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-log-menu={log.id}
          aria-label={t('table.more')}
          className="inline-flex size-8 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          <EllipsisVertical aria-hidden className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {log.requestId ? (
          <DropdownMenuItem
            data-log-action="copy-id"
            onSelect={(event) => {
              event.preventDefault();
              copy(log.requestId, 'id');
            }}
          >
            {copiedId ? (
              <Check aria-hidden className="size-4 text-success" />
            ) : (
              <Copy aria-hidden className={ICON} />
            )}
            {copiedId ? t('menu.copied') : t('menu.copyId')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          data-log-action="copy-curl"
          onSelect={(event) => {
            event.preventDefault();
            copy(curlExample(log), 'curl');
          }}
        >
          {copiedCurl ? (
            <Check aria-hidden className="size-4 text-success" />
          ) : (
            <Terminal aria-hidden className={ICON} />
          )}
          {copiedCurl ? t('menu.copied') : t('menu.copyCurl')}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-log-action="detail"
          onSelect={() => onOpenDetail(log, triggerRef.current)}
        >
          <Eye aria-hidden className={ICON} />
          {t('menu.detail')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
