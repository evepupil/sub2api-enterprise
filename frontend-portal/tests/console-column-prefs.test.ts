import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOG_COLUMNS,
  LOG_COLUMN_PREFS,
  logsTableMinWidth,
} from '@/blocks/console/logs/logs-columns';
import {
  parseColumnPrefs,
  serializeColumnPrefs,
  type ColumnPrefsConfig,
} from '@/lib/console/live/column-prefs';

type Column = 'time' | 'name' | 'price' | 'extra';

const CONFIG: ColumnPrefsConfig<Column> = {
  storageKey: 'test-columns',
  columns: ['time', 'name', 'price', 'extra'],
  defaults: ['time', 'name', 'price'],
  locked: ['time'],
};

describe('列设置的存取', () => {
  it('没存过或格式不对时用默认', () => {
    expect(parseColumnPrefs(null, CONFIG)).toEqual(['time', 'name', 'price']);
    expect(parseColumnPrefs('not json', CONFIG)).toEqual(['time', 'name', 'price']);
    expect(parseColumnPrefs('["name"]', CONFIG)).toEqual(['time', 'name', 'price']);
  });

  it('按表格顺序给出；存过的照存的来，锁定的列总在，不认识的键不管', () => {
    expect(
      parseColumnPrefs('{"extra":true,"name":false,"time":false,"unknown":true}', CONFIG),
    ).toEqual(['time', 'price', 'extra']);
  });

  it('后来加的列没存过时按默认值；存的时候每一列都写明', () => {
    expect(parseColumnPrefs('{"name":false}', CONFIG)).toEqual(['time', 'price']);
    const raw = serializeColumnPrefs(['extra', 'name'], CONFIG);
    expect(JSON.parse(raw)).toEqual({ time: true, name: true, price: false, extra: true });
    expect(parseColumnPrefs(raw, CONFIG)).toEqual(['time', 'name', 'extra']);
  });
});

describe('日志表的列', () => {
  it('默认是原来那几列，推理强度和 IP 默认不显示，时间不能取消', () => {
    expect(parseColumnPrefs(null, LOG_COLUMN_PREFS)).toEqual([...DEFAULT_LOG_COLUMNS]);
    expect(DEFAULT_LOG_COLUMNS).not.toContain('reasoning');
    expect(DEFAULT_LOG_COLUMNS).not.toContain('ip');
    expect(parseColumnPrefs('{"time":false,"ip":true}', LOG_COLUMN_PREFS)).toEqual([
      'time',
      'key',
      'model',
      'tokens',
      'cost',
      'duration',
      'ip',
    ]);
  });

  it('表格最窄宽度跟着显示的列变', () => {
    const base = logsTableMinWidth(DEFAULT_LOG_COLUMNS);
    expect(logsTableMinWidth([...DEFAULT_LOG_COLUMNS, 'reasoning', 'ip'])).toBeGreaterThan(base);
    expect(logsTableMinWidth(['time'])).toBeLessThan(base);
  });
});
