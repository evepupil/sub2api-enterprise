import type { EditionId } from './types';

/**
 * 近 24 小时可用率（占位数据，固定种子生成，每次结果相同）。
 * 接入真实监测后，用接口数据替换 uptimeFor 的返回值即可，界面不用改。
 */
export type SlotStatus = 'up' | 'degraded' | 'down';

export interface UptimeView {
  /** 24 小时平均可用率，百分数，两位小数 */
  percent: number;
  /** 从早到晚 24 个小时格 */
  slots: SlotStatus[];
}

export const UPTIME_SLOTS = 24;

/** 每个版本出现「降级 / 中断」小时格的概率 */
const RISK: Record<EditionId, { down: number; degraded: number }> = {
  personal: { down: 0.006, degraded: 0.035 },
  pro: { down: 0.002, degraded: 0.015 },
  enterprise: { down: 0.0005, degraded: 0.006 },
};

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uptimeFor(modelId: string, edition: EditionId): UptimeView {
  const random = mulberry32(fnv1a(`${modelId}:${edition}`));
  const risk = RISK[edition];
  const slots: SlotStatus[] = [];
  let sum = 0;
  for (let i = 0; i < UPTIME_SLOTS; i++) {
    const r = random();
    if (r < risk.down) {
      slots.push('down');
      sum += 85 + random() * 10;
    } else if (r < risk.degraded) {
      slots.push('degraded');
      sum += 97 + random() * 2.5;
    } else {
      slots.push('up');
      sum += 100;
    }
  }
  return { percent: Math.round((sum / UPTIME_SLOTS) * 100) / 100, slots };
}
