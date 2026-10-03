'use client';

import {
  Building2,
  ChevronsUpDown,
  House,
  Languages,
  LogOut,
  Settings,
  SunMoon,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useId } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuSegmentItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import { type AppLocale, routing } from '@/i18n/routing';
import { useSwitchLocale } from '@/i18n/use-switch-locale';
import { avatarInitial, displayName } from '@/lib/session/display';
import { useSession } from '@/lib/session/session-provider';
import { cn } from '@/lib/utils';

/** 语言名按各自的写法固定显示，不随界面语言翻译 */
const LOCALE_NAMES: Record<AppLocale, string> = { zh: '中文', en: 'English' };

const THEMES = ['light', 'dark'] as const;

/**
 * 头像菜单放在哪里：
 * - sidebar：侧栏展开时，触发按钮带名字与邮箱，菜单向上弹；
 * - rail：侧栏收起成图标栏时只显示头像，菜单向上弹；
 * - bar：手机顶栏右上角只显示头像，菜单向下弹、右对齐。
 */
export type UserMenuPlacement = 'sidebar' | 'rail' | 'bar';

const TRIGGER_CLASS: Record<UserMenuPlacement, string> = {
  sidebar: 'min-w-0 flex-1 gap-2.5 rounded-lg p-1.5 text-left',
  rail: 'w-full justify-center rounded-lg p-1.5',
  bar: 'shrink-0 rounded-full p-0.5',
};

const CONTENT_POSITION: Record<
  UserMenuPlacement,
  { side: 'top' | 'bottom'; align: 'start' | 'end' }
> = {
  sidebar: { side: 'top', align: 'start' },
  rail: { side: 'top', align: 'start' },
  bar: { side: 'bottom', align: 'end' },
};

/** 头像：深色圆底加当前用户显示名的首字；还没读到用户时是浅色空圆 */
export function Avatar({ className }: { className?: string }) {
  const { user } = useSession();
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        user ? 'bg-primary text-primary-foreground' : 'bg-muted',
        className,
      )}
    >
      {user ? avatarInitial(displayName(user)) : null}
    </span>
  );
}

/** 还没读到用户时，名字和邮箱的位置放两条浅色占位条，宽度和真实内容相近，读到后不跳动 */
function TextPlaceholder({ className }: { className: string }) {
  return <span aria-hidden className={cn('block rounded bg-muted', className)} />;
}

/** 菜单里的一行：左边图标加名字，右边一组分段单选，点一下就切换（选完菜单关闭） */
function MenuSegmentRow({
  id,
  icon: Icon,
  label,
  value,
  onValueChange,
  options,
}: {
  /** 写在 data-user-row 上，交互检查用；每个选项带 data-option={value} */
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const labelId = useId();
  return (
    <div data-user-row={id} className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span id={labelId} className="flex min-w-0 items-center gap-2 text-sm text-foreground">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={onValueChange}
        aria-labelledby={labelId}
        className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5"
      >
        {options.map((option) => (
          <DropdownMenuSegmentItem
            key={option.value}
            value={option.value}
            data-option={option.value}
          >
            {option.label}
          </DropdownMenuSegmentItem>
        ))}
      </DropdownMenuRadioGroup>
    </div>
  );
}

/**
 * 账号菜单：当前登录用户的名字、邮箱与所属组织；账户设置、返回官网；语言与主题切换；退出登录。
 * 用户信息来自登录状态（SessionProvider），退出登录会通知后端作废凭证再回到登录页。
 * 侧栏底部和手机顶栏各放一个，样子与弹出方向见 UserMenuPlacement。
 * 交互检查：触发按钮 data-user-menu={placement}，菜单项 data-user-item，语言与主题行 data-user-row。
 */
export function UserMenu({ placement = 'sidebar' }: { placement?: UserMenuPlacement }) {
  const t = useTranslations('console');
  const tc = useTranslations('common');
  const locale = useLocale() as AppLocale;
  const switchLocale = useSwitchLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const session = useSession();
  const user = session.user;
  const name = user ? displayName(user) : '';
  const position = CONTENT_POSITION[placement];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-user-menu={placement}
          aria-label={t('user.menu')}
          className={cn(
            'flex items-center transition-colors hover:bg-muted',
            TRIGGER_CLASS[placement],
          )}
        >
          <Avatar />
          {placement === 'sidebar' ? (
            <>
              <span className="min-w-0 flex-1" data-user-identity>
                {user ? (
                  <>
                    <span className="block truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-subtle-foreground">
                      {user.email}
                    </span>
                  </>
                ) : (
                  <>
                    <TextPlaceholder className="h-3.5 w-20" />
                    <TextPlaceholder className="mt-1.5 h-3 w-32" />
                  </>
                )}
              </span>
              <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={position.side} align={position.align} className="w-64">
        <div className="px-3 py-2" data-user-summary>
          {user ? (
            <>
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate text-xs text-subtle-foreground">{user.email}</p>
              {user.organization ? (
                <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-subtle-foreground">
                  <Building2 aria-hidden className="size-3 shrink-0" />
                  <span className="truncate" data-user-org>
                    {user.organization.name}
                  </span>
                </p>
              ) : null}
            </>
          ) : (
            <>
              <TextPlaceholder className="h-3.5 w-20" />
              <TextPlaceholder className="mt-1.5 h-3 w-32" />
            </>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/console/settings" data-user-item="settings">
            <Settings aria-hidden className="size-4" />
            {t('user.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" data-user-item="site">
            <House aria-hidden className="size-4" />
            {t('user.site')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <MenuSegmentRow
          id="language"
          icon={Languages}
          label={tc('language.title')}
          value={locale}
          onValueChange={switchLocale}
          options={routing.locales.map((code) => ({ value: code, label: LOCALE_NAMES[code] }))}
        />
        <MenuSegmentRow
          id="theme"
          icon={SunMoon}
          label={tc('theme.title')}
          value={resolvedTheme ?? 'light'}
          onValueChange={setTheme}
          options={THEMES.map((theme) => ({ value: theme, label: tc(`theme.${theme}`) }))}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem data-user-item="logout" onSelect={() => void session.signOut()}>
          <LogOut aria-hidden className="size-4" />
          {t('user.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
