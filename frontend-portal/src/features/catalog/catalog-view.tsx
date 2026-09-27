'use client';

import { useState } from 'react';

import { PageHeader } from '../../components/layout/page-header';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import type { CatalogData, CatalogModel, PublicResult } from '../public/types';
import { ModelCard } from './model-card';

const ALL_PROVIDERS = '__all_providers__';
const PROVIDER_VALUE_PREFIX = 'provider:';

export interface CatalogViewProps {
  result: PublicResult<CatalogData>;
}

export function CatalogView({ result }: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState(ALL_PROVIDERS);
  const models = result.kind === 'ready' ? result.data.models : [];
  const providers = new Map<string, string>();

  for (const model of models) {
    const normalized = model.provider.toLowerCase();
    if (!providers.has(normalized)) {
      providers.set(normalized, model.provider);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const selectedProvider =
    providerFilter === ALL_PROVIDERS ? null : providerFilter.slice(PROVIDER_VALUE_PREFIX.length);
  const visibleModels = models.filter((model: CatalogModel) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      model.id.toLowerCase().includes(normalizedSearch) ||
      model.provider.toLowerCase().includes(normalizedSearch);
    const matchesProvider =
      selectedProvider === null || model.provider.toLowerCase() === selectedProvider;

    return matchesSearch && matchesProvider;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="模型与价格"
        actions={<span className="text-sm text-muted-foreground">美元 / 百万 Token</span>}
      />

      {result.kind === 'disabled' ? (
        <EmptyState title="模型目录尚未开放" />
      ) : result.kind === 'authentication-required' ? (
        <EmptyState
          title="请登录后查看模型"
          action={
            <Button asChild>
              <a href="/login?next=/catalog">登录</a>
            </Button>
          }
        />
      ) : result.kind === 'unavailable' ? (
        <Alert
          variant="destructive"
          title="模型价格暂时无法加载"
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              重试
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="catalog-model-search">搜索模型</Label>
              <Input
                id="catalog-model-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="搜索模型代号"
              />
            </div>
            <div className="w-full space-y-2 md:w-48 md:shrink-0">
              <Label htmlFor="catalog-provider-filter">厂家</Label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger id="catalog-provider-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROVIDERS}>全部厂家</SelectItem>
                  {Array.from(providers, ([normalized, name]) => (
                    <SelectItem key={normalized} value={`${PROVIDER_VALUE_PREFIX}${normalized}`}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {models.length === 0 ? (
            <EmptyState title="暂无公开模型" />
          ) : visibleModels.length === 0 ? (
            <EmptyState
              title="没有匹配的模型"
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setProviderFilter(ALL_PROVIDERS);
                  }}
                >
                  清空筛选
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleModels.map((model) => (
                <ModelCard
                  key={`${model.providerKey}:${model.provider}:${model.id}`}
                  model={model}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
