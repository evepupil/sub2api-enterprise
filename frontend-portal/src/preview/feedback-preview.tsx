'use client';

import { useState } from 'react';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton } from '../components/ui/skeleton';
import type { PreviewKey } from './fixtures';
import { KeysPreviewTable } from './keys-preview-table';

type FeedbackState = 'table' | 'loading' | 'empty' | 'error';

export function FeedbackPreview({ rows }: { rows: readonly PreviewKey[] }) {
  const [state, setState] = useState<FeedbackState>('table');

  return (
    <Card>
      <CardHeader>
        <CardTitle>加载、空态与错误</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="group" aria-label="切换数据状态" className="flex flex-wrap gap-2">
          <Button
            data-testid="state-loading"
            variant="outline"
            aria-pressed={state === 'loading'}
            onClick={() => setState('loading')}
          >
            加载
          </Button>
          <Button
            data-testid="state-empty"
            variant="outline"
            aria-pressed={state === 'empty'}
            onClick={() => setState('empty')}
          >
            空数据
          </Button>
          <Button
            data-testid="state-error"
            variant="outline"
            aria-pressed={state === 'error'}
            onClick={() => setState('error')}
          >
            错误
          </Button>
        </div>
        <div
          data-testid="preview-feedback"
          aria-live="polite"
          aria-busy={state === 'loading'}
          className="min-h-60 min-w-0 overflow-hidden rounded-card border border-border p-4"
        >
          {state === 'loading' ? (
            <div className="space-y-5 py-2" aria-label="正在加载示例数据">
              {[0, 1, 2].map((row) => (
                <div key={row} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[0, 1, 2, 3].map((cell) => (
                    <Skeleton key={cell} className="h-4 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          {state === 'empty' ? (
            <div className="flex min-h-52 items-center justify-center">
              <EmptyState title="暂无调用记录" role="status" />
            </div>
          ) : null}
          {state === 'error' ? (
            <div className="flex min-h-52 items-center justify-center">
              <Alert
                variant="destructive"
                title="用量暂时无法加载"
                action={
                  <Button
                    data-testid="retry-preview"
                    size="sm"
                    variant="outline"
                    onClick={() => setState('table')}
                  >
                    重试
                  </Button>
                }
              />
            </div>
          ) : null}
          {state === 'table' ? <KeysPreviewTable rows={rows} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
