'use client';

import { useCallback, useMemo, useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { PageHeader } from '../../components/layout/page-header';
import { useAuth } from '../auth/auth-provider';
import { usePortalQuery } from '../console/use-portal-query';
import type { CatalogData, PublicResult } from '../public/types';
import { parseCatalog } from './adapter';
import { CatalogView } from './catalog-view';

export interface SessionCatalogProps {
  result: PublicResult<CatalogData>;
}

function CatalogSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="正在加载模型价格">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <Skeleton className="h-10 min-w-0 flex-1" />
        <Skeleton className="h-10 w-full md:w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

interface CatalogErrorProps {
  title: string;
  description: string;
  onRetry: () => void;
  retrying: boolean;
}

function CatalogError({ title, description, onRetry, retrying }: CatalogErrorProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="模型与价格"
        actions={<span className="text-sm text-muted-foreground">美元 / 百万 Token</span>}
      />
      <Alert
        variant="destructive"
        title={title}
        description={description}
        action={
          <Button variant="outline" onClick={onRetry} loading={retrying}>
            重试
          </Button>
        }
      />
    </div>
  );
}

export function SessionCatalog({ result }: SessionCatalogProps) {
  const { status, refreshUser } = useAuth();
  const [identityRetrying, setIdentityRetrying] = useState(false);
  const catalogQuery = usePortalQuery<unknown>(
    ['catalog'],
    (request, signal) => request('/model-plaza', { method: 'GET', signal }),
    { enabled: status === 'authenticated' && result.kind !== 'disabled' },
  );

  const authenticatedResult = useMemo<PublicResult<CatalogData> | null>(() => {
    if (!catalogQuery.isSuccess) {
      return null;
    }
    try {
      return { kind: 'ready', data: parseCatalog(catalogQuery.data, { authenticated: true }) };
    } catch {
      return { kind: 'unavailable' };
    }
  }, [catalogQuery.data, catalogQuery.isSuccess]);

  const retryIdentity = useCallback(() => {
    setIdentityRetrying(true);
    void refreshUser()
      .catch(() => undefined)
      .finally(() => setIdentityRetrying(false));
  }, [refreshUser]);

  if (status === 'anonymous' || result.kind === 'disabled') {
    return <CatalogView result={result} />;
  }

  if (status === 'loading') {
    return <CatalogSkeleton />;
  }

  if (status === 'error') {
    return (
      <CatalogError
        title="登录状态验证失败"
        description="无法确认当前账号状态。请重试核实后再查看模型价格。"
        onRetry={retryIdentity}
        retrying={identityRetrying}
      />
    );
  }

  if (catalogQuery.isError || authenticatedResult?.kind === 'unavailable') {
    return (
      <CatalogError
        title="模型价格暂时无法加载"
        description="暂时无法读取模型价格，请稍后重试。"
        onRetry={() => void catalogQuery.refetch()}
        retrying={catalogQuery.isFetching}
      />
    );
  }

  if (catalogQuery.isPending || authenticatedResult === null) {
    return <CatalogSkeleton />;
  }

  return <CatalogView result={authenticatedResult} />;
}
