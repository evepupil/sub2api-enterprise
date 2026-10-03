/**
 * 占位数据用的固定种子随机数：同一个种子每次生成同样的序列，
 * 构建时和浏览器里算出的数字一致，页面不会出现首屏与水合不一致。
 */

/** 字符串 → 32 位种子（FNV-1a） */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32：返回 [0, 1) 的伪随机数生成器 */
export function createRandom(seed: number | string): () => number {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 固定种子的随机串，用于密钥、请求 ID 等占位标识 */
export function randomToken(random: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += BASE62[Math.floor(random() * BASE62.length)];
  return out;
}

/** 在 [min, max] 内按随机数取值 */
export function between(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}
