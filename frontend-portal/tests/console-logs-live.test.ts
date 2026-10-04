import { describe, expect, it } from 'vitest';

import { DEFAULT_SELECTION, isDefaultSelection } from '@/blocks/console/logs/logs-types';
import type { LogRow } from '@/lib/console/live/logs-types';
import {
  curlExample,
  formatUnitPrice,
  logExtras,
  outputSpeed,
  tierOf,
  unitPrices,
} from '@/lib/console/live/logs-view';
import { parseDateRange } from '@/lib/server/sub2api/date-range';
import {
  logsCsv,
  parseLogFilters,
  parseLogQuery,
  toLogOptions,
  toLogRow,
  toLogsPage,
  usageLogsPath,
  type LogsCsvLabels,
} from '@/lib/server/sub2api/usage-logs';

/** 后端一条使用记录（字段名照后端），带着完整的密钥 */
const RAW = {
  id: 42,
  user_id: 2,
  api_key_id: 7,
  request_id: 'req_abc',
  model: 'gpt-5.4',
  service_tier: 'priority',
  reasoning_effort: 'high',
  inbound_endpoint: '/v1/responses',
  group_id: 3,
  input_tokens: 2000,
  output_tokens: 500,
  cache_creation_tokens: 0,
  cache_read_tokens: 1000,
  input_cost: 0.005,
  output_cost: 0.0075,
  cache_creation_cost: 0,
  cache_read_cost: 0.00025,
  total_cost: 0.01275,
  actual_cost: 0.003825,
  rate_multiplier: 0.3,
  long_context_billing_applied: false,
  stream: true,
  duration_ms: 4000,
  first_token_ms: 900,
  image_count: 0,
  user_agent: 'openai-python/1.99.1',
  ip_address: '203.0.113.9',
  billing_mode: 'token',
  created_at: '2026-10-04T07:05:34Z',
  api_key: { id: 7, name: 'prod', key: 'sk-secret-should-not-leak' },
  group: { id: 3, name: '高性能通道', rate_multiplier: 0.3 },
};

const row = toLogRow(RAW) as LogRow;

const query = (search: string) => new URLSearchParams(search);

describe('筛选参数', () => {
  it('日期要合法且不颠倒；密钥要是正整数；类型、流式只认几种写法', () => {
    expect(parseDateRange(query('from=2026-09-01&to=2026-09-30'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(
      parseLogFilters(
        query('from=2026-09-01&to=2026-09-30&key=7&model=gpt-5.4&type=text&stream=stream'),
      ),
    ).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      keyId: 7,
      model: 'gpt-5.4',
      type: 'text',
      stream: 'stream',
    });
    expect(parseLogFilters(query('from=2026-09-01&to=2026-09-30&key=-1'))).toBeNull();
    expect(parseLogFilters(query('from=2026-09-01&to=2026-09-30&type=video'))).toBeNull();
    expect(
      parseLogFilters(query(`from=2026-09-01&to=2026-09-30&model=${'x'.repeat(201)}`)),
    ).toBeNull();
    expect(parseLogFilters(query('from=2026-09-30&to=2026-09-01'))).toBeNull();
  });

  it('分页：页码从 1 开始，每页条数只认分页组件的几档', () => {
    expect(parseLogQuery(query('from=2026-09-01&to=2026-09-30'))).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(parseLogQuery(query('from=2026-09-01&to=2026-09-30&page=3&pageSize=50'))).toMatchObject({
      page: 3,
      pageSize: 50,
    });
    expect(parseLogQuery(query('from=2026-09-01&to=2026-09-30&pageSize=33'))).toBeNull();
    expect(parseLogQuery(query('from=2026-09-01&to=2026-09-30&page=0'))).toBeNull();
  });

  it('后端地址：按时间从新到旧，北京时间；文本按 Token 计费，流式写成 true / false', () => {
    const url = new URL(
      `http://x${usageLogsPath(
        {
          from: '2026-09-01',
          to: '2026-09-30',
          keyId: 7,
          model: 'gpt-5.4',
          type: 'text',
          stream: 'nonStream',
        },
        2,
        20,
      )}`,
    );
    expect(url.pathname).toBe('/usage');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      page_size: '20',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      timezone: 'Asia/Shanghai',
      sort_by: 'created_at',
      sort_order: 'desc',
      api_key_id: '7',
      model: 'gpt-5.4',
      billing_mode: 'token',
      stream: 'false',
    });
  });
});

describe('后端记录 → 日志行', () => {
  it('只挑页面要用的字段，完整的密钥不往外传', () => {
    expect(row).toMatchObject({
      id: 42,
      requestId: 'req_abc',
      key: { id: 7, name: 'prod' },
      group: { id: 3, name: '高性能通道' },
      rate: 0.3,
      serviceTier: 'priority',
      tokens: { input: 2000, output: 500, cacheRead: 1000, cacheWrite: 0 },
      actualCost: 0.003825,
      durationMs: 4000,
      firstTokenMs: 900,
    });
    expect(JSON.stringify(row)).not.toContain('sk-secret');
  });

  it('没有分组时分组为空；密钥对象缺了用 #ID；缺 ID 或时间的记录丢掉', () => {
    const bare = toLogRow({ ...RAW, group_id: null, group: undefined, api_key: undefined });
    expect(bare?.group).toBeNull();
    expect(bare?.key).toEqual({ id: 7, name: '#7' });
    expect(toLogRow({ ...RAW, created_at: undefined })).toBeNull();
    expect(
      toLogsPage({ items: [RAW, { id: 'x' }], total: 1, page: 1, page_size: 20 })?.items,
    ).toHaveLength(1);
  });

  it('筛选选项：密钥取 ID 与名字，模型去重排序', () => {
    expect(
      toLogOptions(
        { items: [{ id: 7, name: 'prod', key: 'sk-secret' }, { id: 8 }] },
        { models: [{ model: 'gpt-5.4' }, { model: 'claude-sonnet-4-6' }, { model: 'gpt-5.4' }] },
      ),
    ).toEqual({
      keys: [
        { id: 7, name: 'prod' },
        { id: 8, name: '#8' },
      ],
      models: ['claude-sonnet-4-6', 'gpt-5.4'],
    });
    expect(toLogOptions(null, null)).toEqual({ keys: [], models: [] });
  });
});

describe('日志行上的计算', () => {
  it('官方价单价 = 分项费用 ÷ Token 数 × 一百万；算不出来为 null', () => {
    expect(unitPrices(row)).toEqual({ input: 2.5, output: 15 });
    expect(unitPrices({ ...row, costs: { ...row.costs, input: 0 } }).input).toBeNull();
    expect(formatUnitPrice(2.5)).toBe('$2.5');
    expect(formatUnitPrice(null)).toBe('—');
  });

  it('计费档、额外信息、输出速度', () => {
    expect(tierOf(null)).toBe('standard');
    expect(tierOf('priority')).toBe('priority');
    expect(tierOf('scale')).toBeNull();
    expect(logExtras(row)).toEqual([{ kind: 'reasoning', value: 'high' }]);
    expect(
      logExtras({
        ...row,
        longContext: true,
        reasoningEffort: null,
        images: { count: 2, size: '1K' },
      }),
    ).toEqual([{ kind: 'longContext' }, { kind: 'images', count: 2, size: '1K' }]);
    expect(outputSpeed(row)).toBe(125);
    expect(outputSpeed({ ...row, durationMs: null })).toBeNull();
  });

  it('curl 示例按这次的接口路径给请求体，密钥用环境变量', () => {
    const curl = curlExample(row);
    expect(curl).toContain('/v1/responses');
    expect(curl).toContain('"input":"…"');
    expect(curl).toContain('$CODU_API_KEY');
    expect(curlExample({ ...row, endpoint: '/v1/messages' })).toContain('"max_tokens":1024');
    expect(curlExample({ ...row, endpoint: null, billingMode: 'image' })).toContain(
      '/v1/images/generations',
    );
  });
});

describe('导出 CSV', () => {
  const labels: LogsCsvLabels = {
    headers: ['时间', '请求 ID', '密钥'],
    yes: '是',
    no: '否',
    noGroup: '未分组',
    tiers: { standard: '标准', priority: '优先', flex: '弹性' },
  };

  it('时间按北京时间，金额 6 位小数，计费档写中文', () => {
    const [header, line] = logsCsv([row], labels).split('\r\n');
    expect(header).toBe('时间,请求 ID,密钥');
    expect(
      line?.startsWith(
        '2026-10-04 15:05:34,req_abc,prod,高性能通道,0.3,gpt-5.4,high,优先,是,2000,500,1000,0,0.003825,0.012750,4000,900,/v1/responses',
      ),
    ).toBe(true);
  });

  it('逗号、引号要转义；以 = + - @ 开头的加单引号，防止表格软件当公式执行', () => {
    const tricky = { ...row, key: { id: 7, name: '=HYPERLINK("x"),a' } };
    const line = logsCsv([tricky], labels).split('\r\n')[1] ?? '';
    expect(line).toContain(`"'=HYPERLINK(""x""),a"`);
  });
});

describe('筛选是否偏离默认', () => {
  it('默认是最近 30 天、其余都不限', () => {
    expect(isDefaultSelection(DEFAULT_SELECTION)).toBe(true);
    expect(isDefaultSelection({ ...DEFAULT_SELECTION, keyId: 7 })).toBe(false);
    expect(
      isDefaultSelection({
        ...DEFAULT_SELECTION,
        range: { preset: 'today', from: '2026-10-04', to: '2026-10-04' },
      }),
    ).toBe(false);
  });
});
