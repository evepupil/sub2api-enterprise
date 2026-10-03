import { toAuthSettings, type AuthSettings } from '@/lib/auth/settings';

import { callBackend } from './client';
import type { BackendResult } from './envelope';

/**
 * 后端公开设置（注册开关、邮箱验证、邀请码、优惠码等）。登录注册页每次打开都要读，
 * 所以在官网服务器上缓存 30 秒：后台改了开关，最多半分钟后官网跟着变。只缓存成功结果。
 */
export const PUBLIC_SETTINGS_TTL_MS = 30_000;

let cached: { at: number; settings: AuthSettings } | null = null;

export async function getAuthSettings(
  forwarded: Headers,
  now: () => number = Date.now,
): Promise<BackendResult<AuthSettings>> {
  if (cached && now() - cached.at < PUBLIC_SETTINGS_TTL_MS) {
    return { ok: true, data: cached.settings };
  }
  const result = await callBackend<unknown>({ method: 'GET', path: '/settings/public', forwarded });
  if (!result.ok) return result;
  const settings = toAuthSettings(result.data);
  cached = { at: now(), settings };
  return { ok: true, data: settings };
}

/** 测试用：清掉缓存 */
export function resetAuthSettingsCache(): void {
  cached = null;
}
