'use client';

import { useState } from 'react';

import { validateKeyDraft, type KeyDraft, type KeyFormErrors } from './keys-model';

/**
 * 创建与编辑弹窗共用的表单状态：草稿、各字段的错误、改字段、提交前校验。
 * 弹窗只在打开时挂载，所以每次打开都从传入的初始草稿重新开始。
 */
export function useKeyForm(initial: KeyDraft) {
  const [draft, setDraft] = useState<KeyDraft>(initial);
  const [errors, setErrors] = useState<KeyFormErrors>({});

  /** 改一个字段，同时清掉它对应的错误（名称一栏、额度一栏各自对应） */
  const update = (patch: Partial<KeyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if ('name' in patch) setErrors((current) => ({ ...current, name: undefined }));
    if ('quota' in patch || 'quotaMode' in patch) {
      setErrors((current) => ({ ...current, quota: undefined }));
    }
  };

  /** 提交前校验：所有出错的字段一起标红，焦点落在第一个；全部通过返回 true */
  const validate = (): boolean => {
    const found = validateKeyDraft(draft);
    if (!found.name && !found.quota) return true;
    setErrors(found);
    document.getElementById(found.name ? 'key-name' : 'key-quota')?.focus();
    return false;
  };

  return { draft, errors, update, validate };
}
