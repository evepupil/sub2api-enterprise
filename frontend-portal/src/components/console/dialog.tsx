'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, useContext, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';

const OVERLAY = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]';

/**
 * 是否在弹窗或抽屉里。弹窗打开时会挡住它外面的滚轮和触摸滚动（免得背后的页面跟着动），而下拉菜单挂在页面最外层，
 * 也算「外面」：弹窗里的下拉要用模态方式打开、自己接管滚动，否则列表滚轮滚不动、只能拖滚动条
 * （2026-10-09 用户反馈创建密钥的分组下拉）。下拉选择与公告铃铛读它。
 */
const InsideDialogContext = createContext(false);

export function useInsideDialog(): boolean {
  return useContext(InsideDialogContext);
}

const DIALOG_SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/**
 * 打开时的焦点：传了 initialFocus（元素 id）就先落在那个输入框，否则交给 Radix（落在第一个可聚焦元素）。
 * 关闭后把焦点还给打开前的元素：弹窗都是受控打开、没有自带触发按钮，不处理的话焦点会掉到页面最上面，
 * 键盘用户就找不到刚才操作的地方。打开前的元素已经不在页面上时（例如点的是下拉菜单里的项）交给 Radix 默认处理。
 */
function useFocusManagement(initialFocus?: string) {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      previous.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const target = initialFocus ? document.getElementById(initialFocus) : null;
      if (target) {
        event.preventDefault();
        target.focus();
      }
    },
    onCloseAutoFocus: (event: Event) => {
      const target = previous.current;
      previous.current = null;
      if (target?.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}

function CloseButton() {
  const t = useTranslations('console');
  return (
    <DialogPrimitive.Close
      aria-label={t('actions.close')}
      data-dialog-close
      className="shrink-0 rounded-md p-1 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X aria-hidden className="size-4" />
    </DialogPrimitive.Close>
  );
}

/**
 * 居中弹窗：标题行（标题、可选一句说明、关闭按钮）、可滚动的主体、底部按钮行。
 * 按 Esc、点遮罩、点关闭都会关；焦点锁在弹窗里。交互检查找 data-dialog={id}。
 */
export function Dialog({
  id,
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof DIALOG_SIZES;
  /** 打开后先聚焦的元素 id（新建类弹窗传第一个输入框） */
  initialFocus?: string;
}) {
  const focus = useFocusManagement(initialFocus);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          data-dialog={id}
          {...focus}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card text-foreground shadow-card focus:outline-none',
            DIALOG_SIZES[size],
          )}
        >
          <InsideDialogContext.Provider value>
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <CloseButton />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
                {footer}
              </div>
            ) : null}
          </InsideDialogContext.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const SHEET_SIDES = {
  right: 'inset-y-0 right-0 w-full max-w-md border-l',
  left: 'inset-y-0 left-0 w-[85vw] max-w-72 border-r',
} as const;

/**
 * 侧边抽屉：从右侧滑出看详情（日志、工单），从左侧滑出做手机导航。
 * titleHidden 为真时标题只给读屏软件。
 */
export function Sheet({
  id,
  open,
  onOpenChange,
  title,
  titleHidden = false,
  side = 'right',
  children,
  footer,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  titleHidden?: boolean;
  side?: keyof typeof SHEET_SIDES;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const focus = useFocusManagement();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          data-sheet={id}
          {...focus}
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 flex flex-col border-border bg-card text-foreground shadow-card focus:outline-none',
            SHEET_SIDES[side],
          )}
        >
          <InsideDialogContext.Provider value>
            {titleHidden ? (
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            ) : (
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <DialogPrimitive.Title className="min-w-0 text-base font-semibold text-foreground">
                  {title}
                </DialogPrimitive.Title>
                <CloseButton />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
          </InsideDialogContext.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 确认弹窗：删除、暂停这类不可撤回或影响调用的操作先确认 */
export function ConfirmDialog({
  id,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  onConfirm,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
}) {
  const t = useTranslations('console');
  return (
    <Dialog
      id={id}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            data-confirm
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </Dialog>
  );
}
