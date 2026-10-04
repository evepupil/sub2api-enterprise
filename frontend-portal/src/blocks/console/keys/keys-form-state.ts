'use client';

import { useState } from 'react';

import {
  FIELD_ORDER,
  validateDraft,
  type KeyDraft,
  type KeyFormErrors,
  type KeyFormMode,
} from './keys-model';

/** 各项出错时要聚焦的控件；分组是下拉，按它的触发按钮找 */
export const FIELD_TARGET: Record<keyof KeyFormErrors, string> = {
  name: '#key-name',
  group: '[data-select="key-group"]',
  customKey: '#key-custom',
  ipWhitelist: '#key-ip-allow',
  ipBlacklist: '#key-ip-block',
  quota: '#key-quota',
  rate5h: '#key-rate-5h',
  rate1d: '#key-rate-1d',
  rate7d: '#key-rate-7d',
  expiryDate: '#key-expiry-date',
};

/** 改了草稿的哪一项，就清掉哪几项的错误 */
const CLEARS: Partial<Record<keyof KeyDraft, readonly (keyof KeyFormErrors)[]>> = {
  name: ['name'],
  groupId: ['group'],
  useCustomKey: ['customKey'],
  customKey: ['customKey'],
  ipLimit: ['ipWhitelist', 'ipBlacklist'],
  ipWhitelist: ['ipWhitelist'],
  ipBlacklist: ['ipBlacklist'],
  quota: ['quota'],
  rateLimit: ['rate5h', 'rate1d', 'rate7d'],
  rate5h: ['rate5h'],
  rate1d: ['rate1d'],
  rate7d: ['rate7d'],
  expiry: ['expiryDate'],
  expiryDate: ['expiryDate'],
};

/**
 * 创建与编辑弹窗共用的表单状态：草稿、各项的错误、改字段、提交前校验。
 * 弹窗只在打开时挂载，所以每次打开都从传入的初始草稿重新开始。
 */
export function useKeyForm(initial: KeyDraft, mode: KeyFormMode, today: string) {
  const [draft, setDraft] = useState<KeyDraft>(initial);
  const [errors, setErrors] = useState<KeyFormErrors>({});

  const update = (patch: Partial<KeyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    const cleared = (Object.keys(patch) as (keyof KeyDraft)[]).flatMap((key) => CLEARS[key] ?? []);
    if (cleared.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        for (const field of cleared) delete next[field];
        return next;
      });
    }
  };

  /** 提交前校验：所有出错的项一起标红，焦点落在最前面那一项；全部通过返回 true */
  const validate = (): boolean => {
    const found = validateDraft(draft, mode, today);
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (first === undefined) return true;
    document.querySelector<HTMLElement>(FIELD_TARGET[first])?.focus();
    return false;
  };

  return { draft, errors, update, validate };
}
