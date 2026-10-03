/**
 * 邀请返利码的暂存：带 ?aff= 的链接打开过一次，30 天内再来注册也能带上返利码。
 * 与现有 sub2api 注册页的做法一致（存在浏览器本地，30 天过期）。
 */

const STORAGE_KEY = 'affiliate_referral_code';
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 网址参数里的返利码：?aff= 或 ?aff_code=，取第一个非空的 */
export function referralCodeFromQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ['aff', 'aff_code']) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return '';
}

export function storeReferralCode(code: string, now = Date.now()): void {
  const value = code.trim();
  if (!value) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code: value, expiresAt: now + REFERRAL_TTL_MS }),
    );
  } catch {
    // 本地存储不可用（隐私模式等）时只在本次页面里生效
  }
}

export function loadReferralCode(now = Date.now()): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { code?: unknown; expiresAt?: unknown };
    const code = typeof parsed.code === 'string' ? parsed.code.trim() : '';
    const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0;
    if (!code || expiresAt <= now) {
      window.localStorage.removeItem(STORAGE_KEY);
      return '';
    }
    return code;
  } catch {
    return '';
  }
}

export function clearReferralCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}
