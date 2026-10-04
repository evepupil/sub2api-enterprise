import type { UsageDimension } from '../usage';

/**
 * 控制台用量页的真实数据：官网服务器把后端 /api/v1/usage/dashboard/overview 的结果换成驼峰写法后交给浏览器。
 * 金额是实际扣费（美元），token 是四类合计。
 */

export interface UsageOverviewSummary {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** 写入缓存的输入 token */
  cacheCreationTokens: number;
  /** 命中缓存的输入 token */
  cacheReadTokens: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  /** 0 表示这段时间没有记录首字耗时的请求 */
  avgFirstTokenMs: number;
  /** 同一范围内最终失败的请求数；拿不到时为 null，界面不显示成功率 */
  failedRequests: number | null;
}

/** 一个时间段（天：YYYY-MM-DD；小时：YYYY-MM-DD HH:00）的用量 */
export interface UsageOverviewBucket {
  bucket: string;
  requests: number;
  tokens: number;
  costUsd: number;
}

/** 一个时间段里某个系列（模型 / 密钥 / 分组）的用量 */
export interface UsageOverviewPoint extends UsageOverviewBucket {
  /** 模型是模型名；密钥、分组是后端 ID 的字符串（没有分组的请求是 '0'） */
  id: string;
  name: string;
}

export interface UsageOverview {
  from: string;
  to: string;
  granularity: 'day' | 'hour';
  summary: UsageOverviewSummary;
  buckets: UsageOverviewBucket[];
  /** 只在请求明细时有内容 */
  series: Record<UsageDimension, UsageOverviewPoint[]>;
}

/** 用量接口最长的范围（天），和后端按天的上限一致 */
export const USAGE_MAX_RANGE_DAYS = 1100;
