'use client';

import { Check, ChevronDown, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CONTROL_BUTTON } from '@/components/console/control-button';
import { useCopy } from '@/components/console/copy-button';
import { buttonClass } from '@/components/console/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatPercent, INVITE_PROGRAM } from '@/lib/console';
import { SITE } from '@/lib/site';

interface ShareItem {
  key: string;
  label: string;
  /** 点击后复制到剪贴板的内容 */
  text: string;
}

/**
 * 分享下拉：复制邀请链接、复制邀请码、生成一段可以直接发给朋友的分享文案。
 * 复制成功后，对应菜单项的文字短暂变成「已复制」，菜单保持打开，方便继续复制别的。
 */
export function InviteShareMenu() {
  const t = useTranslations('consoleInvite');
  const tc = useTranslations('console');
  const { copiedKey, copy } = useCopy();

  const items: readonly ShareItem[] = [
    { key: 'link', label: t('share.copyLink'), text: INVITE_PROGRAM.link },
    {
      key: 'code',
      label: t('share.copyCode', { code: INVITE_PROGRAM.code }),
      text: INVITE_PROGRAM.code,
    },
    {
      key: 'text',
      label: t('share.copyText'),
      text: t('share.text', {
        site: SITE.name,
        bonus: formatPercent(INVITE_PROGRAM.inviteeBonusRate, 0),
        link: INVITE_PROGRAM.link,
      }),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-invite-share
          className={buttonClass({ variant: 'secondary', className: CONTROL_BUTTON })}
        >
          <Share2 aria-hidden />
          {t('link.share')}
          <ChevronDown aria-hidden className="size-3.5! text-subtle-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            data-invite-share-item={item.key}
            // 阻止默认的「选中后关闭菜单」，让用户看到「已复制」
            onSelect={(event) => {
              event.preventDefault();
              copy(item.text, item.key);
            }}
          >
            <span className="min-w-0 flex-1 truncate">
              {copiedKey === item.key ? tc('actions.copied') : item.label}
            </span>
            {copiedKey === item.key ? (
              <Check aria-hidden className="size-4 shrink-0 text-success" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
