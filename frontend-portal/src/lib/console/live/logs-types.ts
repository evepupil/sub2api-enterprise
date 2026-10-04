/**
 * 控制台日志页的真实数据：只有计费成功的调用（用户确认，不显示失败请求）。
 * 官网服务器从后端使用记录（/api/v1/usage）里挑出页面要用的字段交给浏览器，密钥本身不往外传。
 */

export interface LogRow {
  /** 后端记录 ID（表格里唯一） */
  id: number;
  requestId: string;
  /** 记录时间（ISO 时间串） */
  createdAt: string;
  key: { id: number; name: string };
  /** 所在分组；没有分组时为 null */
  group: { id: number; name: string } | null;
  /** 这次扣费用的倍率 */
  rate: number;
  /** 调用时填的模型名 */
  model: string;
  /** 请求里的推理强度（low / medium / high 等），没有为 null */
  reasoningEffort: string | null;
  /** OpenAI 计费档：null 是标准，priority 是优先，flex 是弹性 */
  serviceTier: string | null;
  /** 调用的接口路径，如 /v1/messages */
  endpoint: string | null;
  stream: boolean;
  /** 计费方式：token / image / per_request / video */
  billingMode: string;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** 官方价口径的分项费用（美元，没乘倍率） */
  costs: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  /** 实际扣费（美元） */
  actualCost: number;
  /** 这次按长上下文档计价 */
  longContext: boolean;
  durationMs: number | null;
  firstTokenMs: number | null;
  images: { count: number; size: string | null };
  userAgent: string | null;
  ip: string | null;
}

export interface LogsPageData {
  items: LogRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** 筛选下拉的选项：账号的密钥、这段时间用过的模型 */
export interface LogOptions {
  keys: { id: number; name: string }[];
  models: string[];
}

export type LogType = 'all' | 'text' | 'image';
export type LogStream = 'all' | 'stream' | 'nonStream';

export interface LogFilters {
  from: string;
  to: string;
  keyId: number | null;
  model: string | null;
  type: LogType;
  stream: LogStream;
}

export interface LogQuery extends LogFilters {
  page: number;
  pageSize: number;
}

/** 导出 CSV 最多多少条（按当前筛选，从新到旧） */
export const LOGS_EXPORT_LIMIT = 10_000;
