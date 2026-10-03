import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * 按钮旁边短暂出现的成功提示。外层一直在页面里（读屏软件才会播报后来出现的文字），
 * 没有内容时不占位，出现时给按钮留出间距。
 */
export function SettingsFlash({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <span role="status" className={cn('text-sm text-success', visible && 'mr-3')}>
      {visible ? children : null}
    </span>
  );
}
