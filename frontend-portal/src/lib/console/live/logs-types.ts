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
  /**
   * 服务档位：priority / fast 是 Codex、Claude 的 Fast 模式（后端默认按两倍计费），ultrafast 是 Codex 的 Ultrafast，
   * flex 是低价档；null 是标准
   */
  serviceTier: string | null;
  /** 调用的接口路径，如 /v1/messages */
  endpoint: string | null;
  stream: boolean;
  /** 计费方式：token / image / per_request / video；老记录可能没有 */
  billingMode: string | null;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** 没乘倍率的分项费用（美元）；total 是费用明细里的「原始」 */
  costs: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  /** 实际扣费（美元） */
  actualCost: number;
  /** 这次按长上下文档计价 */
  longContext: boolean;
  durationMs: number | null;
  firstTokenMs: number | null;
  images: LogImages;
  userAgent: string | null;
  ip: string | null;
}

/** 生图相关的记录（费用明细按 sub2api 的口径展示） */
export interface LogImages {
  count: number;
  /** 计费尺寸：1K / 2K / 4K / mixed，老记录可能是别的写法或没有 */
  size: string | null;
  inputSize: string | null;
  outputSize: string | null;
  /** 计费尺寸从哪来：output / input / default / legacy */
  sizeSource: string | null;
  /** 各计费尺寸的张数，如 { '1K': 2 } */
  breakdown: Record<string, number>;
  /** 图片输入、输出的 Token 与费用（美元，没乘倍率），只有按 Token 计费的生图模型才有 */
  inputTokens: number;
  inputCost: number;
  outputTokens: number;
  outputCost: number;
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
