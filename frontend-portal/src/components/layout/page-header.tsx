import * as React from 'react';

import { cn } from '../../lib/utils';

export interface PageHeaderProps extends React.ComponentProps<'div'> {
  /** 页面标题，必填；长标题自然换行。 */
  title: string;
  /** 操作区（按钮等），移动端另起一行。 */
  actions?: React.ReactNode;
}

/**
 * 页面头部：统一深色页面标题，28px 页面字号，长标题自然换行。
 * 操作按钮在桌面与标题同行右对齐，窄屏换到标题下方单独一行。
 * 签名保持 M0 契约（title / actions），仅视觉跟随深色主题。
 */
export function PageHeader({ title, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'flex flex-col items-start justify-between gap-x-6 gap-y-3 md:flex-row md:flex-wrap',
        className,
      )}
      {...props}
    >
      <h1 className="min-w-0 max-w-full text-page font-semibold break-words text-foreground">
        {title}
      </h1>
      {actions !== undefined ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
