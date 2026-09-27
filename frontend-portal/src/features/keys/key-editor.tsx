'use client';

/**
 * 密钥创建/编辑弹窗。
 *
 * 契约来源：design/console-pages.md 密钥章节、DESIGN.md 第 4 章控件契约。
 *
 * 边界：
 * - 表单只持有 KeyDraft 文本状态，校验与载荷构造全部走本模块 validation.ts，
 *   组件不自行拼请求体、不接触令牌（写操作由调用方用 auth.request 完成）。
 * - 分组下拉来自 fetchAvailableGroups；当前密钥已有的分组即使不在可选列表里也保留，
 *   不凭空默认第一个分组。
 * - 编辑的过期时间使用 datetime-local，值由 keyToDraft 按浏览器本地时区生成，
 *   不做 toISOString().slice 之类的 UTC 截断。
 * - 创建成功后只展示后端真实返回的密钥掩码与复制入口，不声称只出现一次。
 * - 弹窗在关闭时由父组件卸载，因此每次打开都是全新状态，不依赖 effect 重置。
 */

import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { createKey, fetchAvailableGroups, updateKey } from './api';
import { formatUsd, keyStatusLabel, safeKeyErrorMessage } from './key-format';
import type { AvailableGroup, KeyDraft, KeyRecord } from './types';
import { buildKeyPayload, createEmptyKeyDraft, keyToDraft, maskKey } from './validation';

/** 下拉里「不指定分组」的哨兵值；Radix Select 不接受空字符串作为 item value。 */
const NO_GROUP_VALUE = '__none__';

export interface KeyEditorDialogProps {
  /** 编辑时传入被编辑记录；创建时为 null。 */
  record: KeyRecord | null;
  request: ApiRequester;
  /** 用户关闭弹窗；由父组件卸载本组件。 */
  onClose: () => void;
  /** 写操作成功后由父组件 refetch 列表。 */
  onSaved: () => void | Promise<void>;
}

export function KeyEditorDialog({ record, request, onClose, onSaved }: KeyEditorDialogProps) {
  const isEdit = record !== null;
  const [draft, setDraft] = useState<KeyDraft>(() =>
    record === null ? createEmptyKeyDraft() : keyToDraft(record),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<KeyRecord | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // 分组可选列表：真实请求，失败时给出可重试的错误而不是伪造分组。
  const groupsQuery = usePortalQuery(
    ['keys', 'available-groups'],
    (req: ApiRequester, signal: AbortSignal) => fetchAvailableGroups(req, signal),
  );

  const selectableGroups = useMemo(() => {
    const items = groupsQuery.data ?? [];
    if (record === null || record.groupId === null) {
      return items;
    }
    if (items.some((group) => group.id === record.groupId)) {
      return items;
    }
    // 当前记录引用的分组已不在可用列表里，仍保留它以免静默改分组。
    const current: AvailableGroup = {
      id: record.groupId,
      name: record.groupName ?? `分组 #${record.groupId}`,
      platform: '',
      subscriptionType: '',
    };
    return [current, ...items];
  }, [groupsQuery.data, record]);

  function patchDraft(patch: Partial<KeyDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  }

  async function handleCopyCreatedKey() {
    if (created === null) {
      return;
    }
    try {
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
        throw new Error('clipboard-unavailable');
      }
      await navigator.clipboard.writeText(created.key);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setError(null);
    // 先按契约本地校验，避免把明显非法输入发到后端；payload 由 validation 生成。
    try {
      buildKeyPayload(draft, isEdit ? 'edit' : 'create');
    } catch (validationError) {
      setError(safeKeyErrorMessage(validationError, '表单内容不正确，请检查后重试'));
      return;
    }

    setSaving(true);
    try {
      const saved = isEdit
        ? await updateKey(request, record.id, draft)
        : await createKey(request, draft);
      await onSaved();
      if (isEdit) {
        onClose();
      } else {
        setCreated(saved);
      }
    } catch (submitError) {
      setError(safeKeyErrorMessage(submitError, '保存失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? '编辑密钥' : '创建密钥'}</DialogTitle>
            <DialogDescription>
              额度与限速填 0 表示不限；IP 名单每行一条，留空表示不限制。
            </DialogDescription>
          </DialogHeader>

          {created !== null ? (
            <div className="space-y-4 py-5">
              <Alert title="密钥已创建" description="请复制并妥善保存，泄露后请立即停用或删除。" />
              <div className="space-y-2">
                <Label htmlFor="created-key-value">密钥</Label>
                <Input id="created-key-value" readOnly value={maskKey(created.key)} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={handleCopyCreatedKey}>
                  复制完整密钥
                </Button>
                {copyState === 'copied' ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    已复制到剪贴板
                  </p>
                ) : null}
                {copyState === 'failed' ? (
                  <p role="alert" className="text-sm text-destructive">
                    复制失败，请手动选中上面的密钥复制
                  </p>
                ) : null}
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">名称</dt>
                  <dd className="break-words">{created.name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">分组</dt>
                  <dd className="break-words">{created.groupName ?? '未指定'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">总额度</dt>
                  <dd>{created.quota > 0 ? formatUsd(created.quota) : '不限'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">状态</dt>
                  <dd>{keyStatusLabel(created.status).label}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="space-y-4 py-5">
              <div className="space-y-2">
                <Label htmlFor="key-name">名称</Label>
                <Input
                  id="key-name"
                  name="name"
                  autoComplete="off"
                  value={draft.name}
                  disabled={saving}
                  aria-invalid={error !== null}
                  onChange={(event) => patchDraft({ name: event.currentTarget.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-group">授权分组</Label>
                {groupsQuery.isError ? (
                  <Alert
                    variant="destructive"
                    title={safeKeyErrorMessage(groupsQuery.error, '分组加载失败，请重试')}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void groupsQuery.refetch();
                        }}
                      >
                        重试
                      </Button>
                    }
                  />
                ) : groupsQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">正在加载分组…</p>
                ) : selectableGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    当前没有可用分组，请先联系管理员。
                  </p>
                ) : (
                  <Select
                    value={draft.groupId === null ? NO_GROUP_VALUE : String(draft.groupId)}
                    disabled={saving}
                    onValueChange={(value) => {
                      patchDraft({ groupId: value === NO_GROUP_VALUE ? null : Number(value) });
                    }}
                  >
                    <SelectTrigger id="key-group" aria-label="授权分组">
                      <SelectValue placeholder="选择分组" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_GROUP_VALUE}>不指定分组</SelectItem>
                      {selectableGroups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                          {group.platform === '' ? '' : ` · ${group.platform}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="key-quota">总额度（USD）</Label>
                  <Input
                    id="key-quota"
                    name="quota"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft.quota}
                    disabled={saving}
                    onChange={(event) => patchDraft({ quota: event.currentTarget.value })}
                  />
                </div>
                {isEdit ? (
                  <div className="space-y-2">
                    <Label htmlFor="key-expires-at">过期时间</Label>
                    <Input
                      id="key-expires-at"
                      name="expires_at"
                      type="datetime-local"
                      value={draft.expiresAt}
                      disabled={saving}
                      onChange={(event) => patchDraft({ expiresAt: event.currentTarget.value })}
                    />
                    <p className="text-xs text-muted-foreground">留空表示清除过期时间。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="key-expires-in-days">有效期（天）</Label>
                    <Input
                      id="key-expires-in-days"
                      name="expires_in_days"
                      inputMode="numeric"
                      autoComplete="off"
                      value={draft.expiresInDays}
                      disabled={saving}
                      onChange={(event) => patchDraft({ expiresInDays: event.currentTarget.value })}
                    />
                    <p className="text-xs text-muted-foreground">留空表示长期有效。</p>
                  </div>
                )}
              </div>

              <div className="rounded-card border border-border">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((previous) => !previous)}
                >
                  高级限制
                  <span aria-hidden="true">{advancedOpen ? '收起' : '展开'}</span>
                </Button>
                {advancedOpen ? (
                  <div className="space-y-4 border-t border-border px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="key-limit-5h">5 小时限额</Label>
                        <Input
                          id="key-limit-5h"
                          inputMode="decimal"
                          autoComplete="off"
                          value={draft.limit5h}
                          disabled={saving}
                          onChange={(event) => patchDraft({ limit5h: event.currentTarget.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="key-limit-1d">1 天限额</Label>
                        <Input
                          id="key-limit-1d"
                          inputMode="decimal"
                          autoComplete="off"
                          value={draft.limit1d}
                          disabled={saving}
                          onChange={(event) => patchDraft({ limit1d: event.currentTarget.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="key-limit-7d">7 天限额</Label>
                        <Input
                          id="key-limit-7d"
                          inputMode="decimal"
                          autoComplete="off"
                          value={draft.limit7d}
                          disabled={saving}
                          onChange={(event) => patchDraft({ limit7d: event.currentTarget.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="key-ip-whitelist">IP 白名单</Label>
                      <textarea
                        id="key-ip-whitelist"
                        name="ip_whitelist"
                        rows={3}
                        value={draft.ipWhitelist}
                        disabled={saving}
                        spellCheck={false}
                        placeholder="每行一条，例如 203.0.113.7"
                        onChange={(event) => patchDraft({ ipWhitelist: event.currentTarget.value })}
                        className="flex w-full min-w-0 rounded-control border border-input bg-card px-3 py-2 text-base text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="key-ip-blacklist">IP 黑名单</Label>
                      <textarea
                        id="key-ip-blacklist"
                        name="ip_blacklist"
                        rows={3}
                        value={draft.ipBlacklist}
                        disabled={saving}
                        spellCheck={false}
                        placeholder="每行一条"
                        onChange={(event) => patchDraft({ ipBlacklist: event.currentTarget.value })}
                        className="flex w-full min-w-0 rounded-control border border-input bg-card px-3 py-2 text-base text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">限速与 IP 名单留空表示不限制。</p>
                  </div>
                ) : null}
              </div>

              {error !== null ? <Alert variant="destructive" title={error} /> : null}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {created === null ? '取消' : '关闭'}
            </Button>
            {created === null ? (
              <Button type="submit" loading={saving}>
                {isEdit ? '保存修改' : '创建密钥'}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
