import { describe, expect, it } from 'vitest';

import {
  API_KEYS,
  csvCell,
  curlFor,
  DEFAULT_RANGE,
  filterLogs,
  logsToCsv,
  maskKey,
  presetRange,
  rechargeBonus,
  REQUEST_LOGS,
  searchKeys,
  type LogFilter,
} from '@/lib/console';

const ALL_LOGS: LogFilter = {
  range: presetRange('all'),
  keyId: 'all',
  modelId: 'all',
  status: 'all',
  type: 'all',
  stream: 'all',
  query: '',
};

describe('请求日志', () => {
  it('240 条，按时间倒序，都在最近 30 天', () => {
    expect(REQUEST_LOGS).toHaveLength(240);
    for (let i = 1; i < REQUEST_LOGS.length; i++) {
      expect(REQUEST_LOGS[i - 1]!.ts).toBeGreaterThanOrEqual(REQUEST_LOGS[i]!.ts);
    }
    expect(filterLogs(REQUEST_LOGS, { ...ALL_LOGS, range: DEFAULT_RANGE })).toHaveLength(240);
  });

  it('失败请求不计费、没有输出', () => {
    const errors = REQUEST_LOGS.filter((log) => log.status === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((log) => log.costUsd === 0 && log.outputTokens === 0)).toBe(true);
    expect(errors.every((log) => log.finishReason === 'error' && log.errorCode !== null)).toBe(
      true,
    );
  });

  it('组合筛选', () => {
    const errors = filterLogs(REQUEST_LOGS, { ...ALL_LOGS, status: 'error' });
    expect(errors.every((log) => log.status === 'error')).toBe(true);
    const images = filterLogs(REQUEST_LOGS, { ...ALL_LOGS, type: 'image' });
    expect(images.every((log) => log.modelId === 'gpt-image-2' && !log.stream)).toBe(true);
    const byKey = filterLogs(REQUEST_LOGS, { ...ALL_LOGS, keyId: 'key-claude-code' });
    expect(byKey.every((log) => log.client.startsWith('claude-cli'))).toBe(true);
    const first = REQUEST_LOGS[0]!;
    expect(filterLogs(REQUEST_LOGS, { ...ALL_LOGS, query: first.id.slice(4, 12) })).toEqual([
      first,
    ]);
    const today = filterLogs(REQUEST_LOGS, { ...ALL_LOGS, range: presetRange('today') });
    expect(today.length).toBeLessThan(REQUEST_LOGS.length);
  });

  it('CSV 转义与导出', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
    const csv = logsToCsv(REQUEST_LOGS.slice(0, 3)).split('\n');
    expect(csv).toHaveLength(4);
    expect(csv[0]?.startsWith('time,request_id,key,model')).toBe(true);
  });

  it('复制为 curl 按协议选接口', () => {
    const claude = REQUEST_LOGS.find((log) => log.modelId === 'claude-sonnet-5-5')!;
    expect(curlFor(claude)).toContain('/v1/messages');
    const image = REQUEST_LOGS.find((log) => log.type === 'image')!;
    expect(curlFor(image)).toContain('/v1/images/generations');
    const gpt = REQUEST_LOGS.find((log) => log.modelId === 'gpt-6-sol')!;
    expect(curlFor(gpt)).toContain('/v1/chat/completions');
  });
});

describe('密钥', () => {
  it('打码保留前 9 位与末 4 位', () => {
    const key = API_KEYS[0]!;
    expect(maskKey(key.secret)).toBe(`${key.secret.slice(0, 9)}…${key.secret.slice(-4)}`);
    expect(key.secret.startsWith('sk-')).toBe(true);
  });

  it('按名称、密钥末尾与状态搜索', () => {
    expect(searchKeys(API_KEYS, '', 'all')).toHaveLength(5);
    expect(searchKeys(API_KEYS, 'claude', 'all').map((k) => k.id)).toEqual(['key-claude-code']);
    const tail = API_KEYS[2]!.secret.slice(-6);
    expect(searchKeys(API_KEYS, tail, 'all').map((k) => k.id)).toEqual(['key-test']);
    expect(searchKeys(API_KEYS, '', 'paused').map((k) => k.id)).toEqual(['key-labeling']);
    expect(searchKeys(API_KEYS, '', 'expired').map((k) => k.id)).toEqual(['key-legacy']);
  });
});

describe('充值弹窗', () => {
  it('充值赠送按档位从高到低取', () => {
    expect(rechargeBonus(100)).toBe(0);
    expect(rechargeBonus(200)).toBe(10);
    expect(rechargeBonus(500)).toBe(50);
  });
});
