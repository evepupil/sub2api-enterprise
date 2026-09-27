'use client';

/**
 * 密钥行内操作：复制、编辑、启停、用量、删除。
 *
 * 契约来源：design/console-pages.md 密钥章节。
 *
 * 边界：
 * - 复制与删除是全值敏感操作：复制需要明确动作并给出成功/失败反馈，
 *   复制内容始终是后端返回的完整 key（本组件不做掩码或截断）；
 *   删除必须在确认弹窗里显示密钥名称。
 * - 用量是明细跳转，不在此处展示额度/限速摘要：跳到 /console/usage?api_key_id=，
 *   由用量页按同一后端数据筛选该密钥的调用明细。
 * - 只有 active/inactive 允许直接切换状态；expired/quota_exhausted/disabled
 *   不提供「启用」按钮，改为提示通过编辑额度或有效期解决。
 * - 所有写操作走调用方注入的 request（本模块 api），成功后 refetch 列表；
 *   本组件不接触令牌、不自行重试，缓存隔离由 AuthProvider 负责。
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
import type { ApiRequester } from '../auth/types';
import { deleteKey, setKeyStatus } from './api';
import { keyStatusHint, keyToggleTarget, safeKeyErrorMessage } from './key-format';
import type { KeyRecord } from './types';

export interface KeyRowActionsProps {
  record: KeyRecord;
  request: ApiRequester;
  onEdit: (record: KeyRecord) => void;
  /** 停用/删除等写操作成功后刷新列表。 */
  onChanged: () => void | Promise<void>;
}

export function KeyRowActions({ record, request, onEdit, onChanged }: KeyRowActionsProps) {
  const router = useRouter();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // null 表示该状态不允许直接切换，必须编辑额度或有效期。
  const toggleTarget = keyToggleTarget(record.status);
  const statusHint = keyStatusHint(record.status);

  async function handleCopy() {
    setActionError(null);
    try {
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
        throw new Error('clipboard-unavailable');
      }
      // 复制完整密钥，不做掩码处理。
      await navigator.clipboard.writeText(record.key);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  function openUsage() {
    router.push(`/console/usage?api_key_id=${record.id}`);
  }

  async function handleToggleStatus() {
    if (toggling || toggleTarget === null) {
      return;
    }
    setToggling(true);
    setActionError(null);
    try {
      await setKeyStatus(request, record.id, toggleTarget);
      await onChanged();
    } catch (toggleError) {
      setActionError(
        safeKeyErrorMessage(
          toggleError,
          toggleTarget === 'inactive' ? '停用失败，请重试' : '启用失败，请重试',
        ),
      );
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      await deleteKey(request, record.id);
      await onChanged();
      setDeleteOpen(false);
    } catch (deleteError) {
      setActionError(safeKeyErrorMessage(deleteError, '删除失败，请重试'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        aria-label={`复制密钥 ${record.name}`}
      >
        复制
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onEdit(record)}
        aria-label={`编辑密钥 ${record.name}`}
      >
        编辑
      </Button>
      {toggleTarget !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={toggling}
          onClick={handleToggleStatus}
          aria-label={`${toggleTarget === 'inactive' ? '停用' : '启用'}密钥 ${record.name}`}
        >
          {toggleTarget === 'inactive' ? '停用' : '启用'}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openUsage}
        aria-label={`查看密钥 ${record.name} 的用量明细`}
      >
        用量
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        aria-label={`删除密钥 ${record.name}`}
      >
        删除
      </Button>

      {copyState === 'copied' ? (
        <span role="status" className="text-xs text-muted-foreground">
          已复制
        </span>
      ) : null}
      {copyState === 'failed' ? (
        <span role="alert" className="text-xs text-destructive">
          复制失败，请手动复制
        </span>
      ) : null}
      {statusHint !== null ? (
        <span className="text-xs text-muted-foreground">{statusHint}</span>
      ) : null}
      {actionError !== null ? (
        <span role="alert" className="text-xs text-destructive">
          {actionError}
        </span>
      ) : null}

      <Dialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen);
          if (!nextOpen) {
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除密钥</DialogTitle>
            <DialogDescription>
              删除后使用该密钥的请求会立即失败，且无法恢复。确认删除「{record.name}」吗？
            </DialogDescription>
          </DialogHeader>
          {actionError !== null ? (
            <div className="pt-5">
              <Alert variant="destructive" title={actionError} />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </Button>
            <Button type="button" variant="destructive" loading={deleting} onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
