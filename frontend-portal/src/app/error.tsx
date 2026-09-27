'use client';

import { Button } from '@/components/ui/button';

/**
 * 全局错误边界：只给短中文提示与重试按钮，
 * 不渲染 error.message，也不把原始错误传给客户端。
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="flex max-w-dialog flex-col items-center gap-4 text-center">
        <p className="text-base font-medium text-foreground">页面暂时无法加载</p>
        <Button type="button" onClick={reset}>
          重试
        </Button>
      </div>
    </div>
  );
}
