import { describe, expect, it } from 'vitest';

import { DEFAULT_SELECTION, isDefaultSelection } from '@/blocks/console/logs/logs-types';
import type { LogRow } from '@/lib/console/live/logs-types';
import {
  costBreakdown,
  costTier,
  curlExample,
  fastModeOf,
  formatPerMillion,
  formatPreciseUsd,
  outputSpeed,
  type CostBreakdown,
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

  it('生图字段：各尺寸张数只留正整数；没写计费方式时为 null', () => {
    const image = toLogRow({
      ...RAW,
      billing_mode: undefined,
      image_count: 3,
      image_size: '2K',
      image_size_source: 'output',
      image_output_size: '2048x2048',
      image_size_breakdown: { '1K': 1, '2K': 2, '4K': 0, bad: 'x' },
      image_output_tokens: 1000,
      image_output_cost: 0.04,
    });
    expect(image?.billingMode).toBeNull();
    expect(image?.images).toEqual({
      count: 3,
      size: '2K',
      inputSize: null,
      outputSize: '2048x2048',
      sizeSource: 'output',
      breakdown: { '1K': 1, '2K': 2 },
      inputTokens: 0,
      inputCost: 0,
      outputTokens: 1000,
      outputCost: 0.04,
    });
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

/** 明细里各项的名字（按出现顺序） */
const keysOf = (breakdown: CostBreakdown) => breakdown.lines.map((line) => line.key);

/** 明细里某一项的值 */
const valueOf = (breakdown: CostBreakdown, key: string) =>
  breakdown.lines.find((line) => line.key === key)?.value;

describe('费用明细（和 sub2api 使用记录的悬浮明细一致）', () => {
  it('按 Token 计费：有的分项费用、按这次费用反算的每百万单价、缓存费用；下面是档位、倍率、原始、扣费', () => {
    const breakdown = costBreakdown(row);
    expect(keysOf(breakdown)).toEqual([
      'inputCost',
      'outputCost',
      'inputPrice',
      'outputPrice',
      'cacheReadCost',
    ]);
    expect(valueOf(breakdown, 'inputCost')).toEqual({ type: 'usd', amount: 0.005 });
    const input = valueOf(breakdown, 'inputPrice');
    const output = valueOf(breakdown, 'outputPrice');
    expect(input?.type === 'perMillion' ? input.amount : null).toBeCloseTo(2.5);
    expect(output?.type === 'perMillion' ? output.amount : null).toBeCloseTo(15);
    expect(breakdown).toMatchObject({
      tier: { kind: 'known', tier: 'fast' },
      rate: 0.3,
      original: 0.01275,
      billed: 0.003825,
    });
  });

  it('费用为 0 的分项不列；没有输出费用时也不列输出单价', () => {
    const free = costBreakdown({
      ...row,
      costs: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0.001, total: 0.001 },
    });
    // 输入单价只看有没有输入 Token（和 sub2api 一样），所以会是 $0
    expect(keysOf(free)).toEqual(['inputPrice', 'cacheWriteCost']);
    expect(valueOf(free, 'inputPrice')).toEqual({ type: 'perMillion', amount: 0 });
  });

  it('按 Token 计费的生图模型：图片的输入输出费用、单价单独列，文字部分扣掉图片 Token 再算', () => {
    const breakdown = costBreakdown({
      ...row,
      tokens: { input: 100, output: 1200, cacheRead: 0, cacheWrite: 0 },
      costs: { input: 0.0005, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.0425 },
      images: {
        ...row.images,
        count: 1,
        outputTokens: 1000,
        outputCost: 0.04,
      },
    });
    expect(keysOf(breakdown)).toEqual([
      'inputCost',
      'outputCost',
      'imageOutputCost',
      'inputPrice',
      'outputPrice',
      'imageOutputPrice',
    ]);
    const text = valueOf(breakdown, 'outputPrice');
    const image = valueOf(breakdown, 'imageOutputPrice');
    expect(text?.type === 'perMillion' ? text.amount : null).toBeCloseTo(10);
    expect(image?.type === 'perMillion' ? image.amount : null).toBeCloseTo(40);
  });

  it('按张计费的生图：张数、计费尺寸、尺寸来源、输入输出尺寸、各尺寸张数、单张价格、图片总价', () => {
    const breakdown = costBreakdown({
      ...row,
      billingMode: 'image',
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      costs: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.08 },
      images: {
        ...row.images,
        count: 2,
        size: '2K',
        sizeSource: 'output',
        outputSize: '2048x2048',
        breakdown: { '2K': 2 },
      },
    });
    expect(breakdown.lines).toEqual([
      { key: 'imageCount', value: { type: 'images', count: 2 } },
      { key: 'imageBillingSize', value: { type: 'text', text: '2K' } },
      { key: 'imageSizeSource', value: { type: 'note', note: 'sourceOutput' } },
      { key: 'imageInputSize', value: { type: 'note', note: 'unknown' } },
      { key: 'imageOutputSize', value: { type: 'text', text: '2048x2048' } },
      { key: 'imageSizeBreakdown', value: { type: 'text', text: '2K x 2' } },
      { key: 'imageUnitPrice', value: { type: 'usd', amount: 0.04 } },
      { key: 'imageTotalPrice', value: { type: 'usd', amount: 0.08 } },
    ]);
  });

  it('老的生图记录：尺寸不标准写「历史非标准」，没尺寸也没来源写未记录；没写计费方式也算生图', () => {
    const legacy = costBreakdown({
      ...row,
      billingMode: null,
      images: { ...row.images, count: 1, size: '1024x1024' },
    });
    expect(valueOf(legacy, 'imageBillingSize')).toEqual({ type: 'legacySize', size: '1024x1024' });
    expect(valueOf(legacy, 'imageSizeSource')).toEqual({ type: 'note', note: 'sourceLegacy' });
    const bare = costBreakdown({
      ...row,
      billingMode: 'image',
      images: { ...row.images, count: 1 },
    });
    expect(valueOf(bare, 'imageBillingSize')).toEqual({ type: 'note', note: 'notRecorded' });
    expect(valueOf(bare, 'imageSizeSource')).toEqual({ type: 'note', note: 'sourceMissing' });
    expect(keysOf(bare)).not.toContain('imageSizeBreakdown');
  });

  it('按次计费（和视频）：列单次价格', () => {
    const perRequest = costBreakdown({
      ...row,
      billingMode: 'per_request',
      costs: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.02 },
    });
    expect(perRequest.lines).toEqual([
      { key: 'requestPrice', value: { type: 'usd', amount: 0.02 } },
    ]);
  });

  it('服务档位：没写或 default 是 Standard，fast 与 priority 都是 Fast，认不出的原样', () => {
    expect(costTier(null)).toEqual({ kind: 'known', tier: 'standard' });
    expect(costTier('default')).toEqual({ kind: 'known', tier: 'standard' });
    expect(costTier('fast')).toEqual({ kind: 'known', tier: 'fast' });
    expect(costTier('Priority')).toEqual({ kind: 'known', tier: 'fast' });
    expect(costTier('flex')).toEqual({ kind: 'known', tier: 'flex' });
    expect(costTier('ultrafast')).toEqual({ kind: 'known', tier: 'ultrafast' });
    expect(costTier('scale')).toEqual({ kind: 'raw', value: 'scale' });
  });

  it('金额 6 位小数，单价 4 位小数，算不出来的单价写「-」', () => {
    expect(formatPreciseUsd(0.0032241)).toBe('US$0.003224');
    expect(formatPerMillion(4)).toBe('US$4.0000');
    expect(formatPerMillion(null)).toBe('-');
  });
});

describe('日志行上的计算', () => {
  it('Fast 模式：priority、fast 算 Fast，ultrafast 单独标；普通调用和 flex 不标', () => {
    expect(fastModeOf('priority')).toBe('fast');
    expect(fastModeOf(' Fast ')).toBe('fast');
    expect(fastModeOf('ultrafast')).toBe('ultrafast');
    expect(fastModeOf('flex')).toBeNull();
    expect(fastModeOf('default')).toBeNull();
    expect(fastModeOf(null)).toBeNull();
  });

  it('输出速度 = 输出 Token ÷ 总耗时；没有耗时为 null', () => {
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
    fast: { fast: 'Fast', ultrafast: 'Ultrafast' },
  };

  it('时间按北京时间，金额 6 位小数，开了 Fast 的写 Fast、普通调用留空', () => {
    const [header, line] = logsCsv([row], labels).split('\r\n');
    expect(header).toBe('时间,请求 ID,密钥');
    expect(
      line?.startsWith(
        '2026-10-04 15:05:34,req_abc,prod,高性能通道,0.3,gpt-5.4,high,Fast,是,2000,500,1000,0,0.003825,0.012750,4000,900,/v1/responses',
      ),
    ).toBe(true);
    const plain = logsCsv([{ ...row, serviceTier: null }], labels).split('\r\n')[1] ?? '';
    expect(plain).toContain(',high,,是,');
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
