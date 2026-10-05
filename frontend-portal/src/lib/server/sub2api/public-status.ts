import type { ProbeStatus, StatusEntry } from '@/lib/catalog/live';

/**
 * 后端对外服务状态（GET /api/v1/status，不用登录，后台开了「对外服务状态」才有）→ 官网模型卡的可用率。
 * 数据来自后台建的渠道监测项：每项定时真发一次小请求，记下状态、对话延迟与端点 PING。
 * 对外版本不带模型名，官网按「监测项名称 = 模型名、分组标签 = 通道名」对上号。纯函数，单测锁住。
 */

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** 后端档位 → 卡片上的颜色档：正常、变慢（仍可用）、不可用、无数据 */
const PROBE_STATUS: Record<string, ProbeStatus> = {
  operational: 'up',
  degraded: 'slow',
  outage: 'down',
};

const probeStatus = (value: unknown): ProbeStatus =>
  (typeof value === 'string' ? PROBE_STATUS[value] : undefined) ?? 'unknown';

function toEntry(raw: RawRecord): StatusEntry | null {
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;
  const timeline = Array.isArray(raw.timeline) ? raw.timeline.filter(isRecord) : [];
  return {
    name: raw.name.trim(),
    group: typeof raw.group_name === 'string' ? raw.group_name.trim() : '',
    latencyMs: num(raw.latency_ms),
    pingMs: num(raw.ping_latency_ms),
    availability: num(raw.availability_7d) ?? 0,
    // 后端已按时间从早到晚排好
    probes: timeline.map((point) => probeStatus(point.status)),
  };
}

/** 对外服务状态 → 监测项列表；看不懂时为 null */
export function toStatusEntries(raw: unknown): StatusEntry[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.components)) return null;
  return raw.components
    .filter(isRecord)
    .map(toEntry)
    .filter((entry): entry is StatusEntry => entry !== null);
}
