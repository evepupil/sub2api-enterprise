import { addDays, TODAY, type OrgInvitation } from '@/lib/console';

/** 邀请链接的注册地址（占位），后面拼上 ?org=邀请码 */
export const INVITE_REGISTER_URL = 'https://codu.example/register';

export type InviteExpiry = '7d' | '30d';

export const INVITE_EXPIRIES: readonly InviteExpiry[] = ['7d', '30d'];

const INVITE_EXPIRY_DAYS: Record<InviteExpiry, number> = { '7d': 7, '30d': 30 };

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** 邀请码由前缀加两段各 4 位的大写字母数字组成 */
const CODE_SEGMENT_LENGTH = 4;

function randomChars(length: number): string {
  // 256 不能被 36 整除，超出整倍数的字节丢掉重取，避免前几个字符出现得更频繁
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < limit && out.length < length) {
        out += CODE_ALPHABET.charAt(byte % CODE_ALPHABET.length);
      }
    }
  }
  return out;
}

/**
 * 生成邀请码 ORG-XXXX-XXXX，随机数来自浏览器的安全随机源。
 * 只在点击事件里调用，渲染过程中不要调。
 */
export function generateInviteCode(): string {
  return `ORG-${randomChars(CODE_SEGMENT_LENGTH)}-${randomChars(CODE_SEGMENT_LENGTH)}`;
}

export function inviteLink(code: string): string {
  return `${INVITE_REGISTER_URL}?org=${encodeURIComponent(code)}`;
}

/** 新邀请码：今天创建，有效期按所选天数从今天算起，状态为有效、还没有使用者 */
export function buildInvitation(code: string, expiry: InviteExpiry): OrgInvitation {
  return {
    code,
    createdAt: TODAY,
    expiresAt: addDays(TODAY, INVITE_EXPIRY_DAYS[expiry]),
    status: 'active',
    usedBy: null,
  };
}
