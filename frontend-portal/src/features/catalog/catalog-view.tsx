'use client';

import { useState } from 'react';

import { ArrowRight, Search } from 'lucide-react';
import { MarketingLink } from '../../components/marketing/marketing-link';
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
    <div className="public-page public-page-catalog space-y-8">
      <section
        className="public-page-hero"
        data-slot="marketing-hero"
        aria-labelledby="catalog-title"
      >
        <div className="public-page-hero-row">
          <div className="public-page-hero-copy">
            <p className="public-page-eyebrow">模型目录 / CATALOG</p>
            <h1 id="catalog-title" className="public-page-title">
              为你的下一步，找到合适的模型。
            </h1>
            <p className="public-page-description">
              按厂家、代号和四项实际价格快速比较，选好模型后用同一个账户接入你的工作流。
            </p>
          </div>
          <MarketingLink href="/help" variant="outline" arrow>
            查看接入说明
          </MarketingLink>
        </div>
        <div className="public-page-tags" aria-label="目录信息">
          <span>
            <ArrowRight aria-hidden="true" /> 四维价格
          </span>
          <span>
            <ArrowRight aria-hidden="true" /> 美元计费
          </span>
          <span>
            <ArrowRight aria-hidden="true" /> 一个账户
          </span>
        </div>
      </section>

      {result.kind === 'disabled' ? (
        <div className="public-page-state">
          <EmptyState title="模型目录尚未开放" />
        </div>
      ) : result.kind === 'authentication-required' ? (
        <div className="public-page-state">
          <EmptyState
            title="请登录后查看模型"
            description="登录后可以查看当前账户适用的模型分组和价格。"
            action={
              <Button asChild>
                <a href="/login?next=/catalog">登录</a>
              </Button>
            }
          />
        </div>
      ) : result.kind === 'unavailable' ? (
        <div className="public-page-state">
          <Alert
            variant="destructive"
            title="模型价格暂时无法加载"
            action={
              <Button variant="outline" onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section className="catalog-toolbar marketing-surface" aria-label="模型筛选">
            <div className="catalog-field min-w-0">
              <Label htmlFor="catalog-model-search">搜索模型</Label>
              <div className="catalog-input-wrap">
                <Search aria-hidden="true" className="catalog-input-icon" />
                <Input
                  id="catalog-model-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="搜索模型代号或厂家"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="catalog-field catalog-provider-field">
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
            <p className="catalog-toolbar-note">价格单位：美元 / 百万 Token</p>
          </section>

          {models.length === 0 ? (
            <EmptyState
              title="暂无公开模型"
              description="当前没有可展示的模型价格，请稍后再来查看。"
            />
          ) : visibleModels.length === 0 ? (
            <EmptyState
              title="没有匹配的模型"
              description="换一个模型代号或厂家，继续查找可用价格。"
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
            <div className="catalog-model-grid" data-slot="catalog-grid">
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
