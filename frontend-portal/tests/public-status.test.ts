/**
 * M1 公开状态适配（status adapter）业务规则测试。
 *
 * 契约来源：design/status.md、design/public-site.md 第 3 节与
 * src/features/public/types.ts 的 StatusData。
 *
 * 事实：
 * - parseStatus 把去掉 API 包装的原始对象适配为 StatusData 白名单字段。
 * - 合法 payload 转化为明确日期与数值；日期按时间序处理，乱序记录输出正序。
 * - 单个组件时间线最多保留最近 60 条。
 * - 数值 0 是有效值（0ms / 0%）必须保留，不与「未知/缺失」混淆。
 * - availability 的 null、缺失的 history、未知 status 字符串都不得被猜成正常。
 * - components 为空时，顶层 level 为 unknown、总 availability 为 null。
 * - 非法数值、非法时间、非法对象一律抛错（由请求层转为不可用）。
 * - 额外字段（provider/ids/errors 等）绝不进入结果。
 * - 历史点只含 level/checkedAt，不含速度；不根据历史推算总可用率。
 *
 * 只测业务逻辑，不镜像 CSS/JSX。fixture 以固定 ISO 基准构造。
 */
import { describe, expect, it } from 'vitest';

import { parseStatus } from '../src/features/status/adapter';

/** 固定 ISO 基准时间（UTC）。 */
const BASE_ISO = '2026-09-27T10:00:00.000Z';

type RawRecord = Record<string, unknown>;

/** 相对基准偏移若干毫秒后的 ISO 字符串。 */
function shiftIso(deltaMs: number): string {
  return new Date(Date.parse(BASE_ISO) + deltaMs).toISOString();
}

/** 取数组中指定下标，越界即报错，避免 any 与静默 undefined。 */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) {
    throw new Error(`fixture 索引 ${index} 越界`);
  }
  return value;
}

/** 构造一个时间线点，默认使用基准时间的 operational。 */
function makePoint(overrides: RawRecord = {}): RawRecord {
  return { status: 'operational', checked_at: BASE_ISO, ...overrides };
}

/** 构造一个组件，默认合法。 */
function makeComponent(overrides: RawRecord = {}): RawRecord {
  return {
    name: 'API',
    group_name: '核心',
    status: 'operational',
    availability_7d: 99.9,
    latency_ms: 120,
    timeline: [makePoint()],
    ...overrides,
  };
}

/** 构造一份状态 payload，默认合法。 */
function makeStatus(overrides: RawRecord = {}): RawRecord {
  return {
    status: 'operational',
    updated_at: BASE_ISO,
    availability_7d: 99.5,
    components: [makeComponent()],
    ...overrides,
  };
}

describe('parseStatus 合法 payload', () => {
  it('转化为明确日期与数值', () => {
    const result = parseStatus(makeStatus());

    expect(result.level).toBe('operational');
    expect(result.availability).toBe(99.5);
    expect(new Date(result.updatedAt).toISOString()).toBe(BASE_ISO);

    const component = at(result.components, 0);
    expect(component.name).toBe('API');
    expect(component.groupName).toBe('核心');
    expect(component.level).toBe('operational');
    expect(component.availability).toBe(99.9);
    expect(component.latencyMs).toBe(120);
    expect(component.history).toHaveLength(1);
    expect(new Date(at(component.history, 0).checkedAt).toISOString()).toBe(BASE_ISO);
  });

  it('带时区的时间归一为同一时刻', () => {
    const result = parseStatus(makeStatus({ updated_at: '2026-09-27T18:00:00+08:00' }));

    expect(new Date(result.updatedAt).toISOString()).toBe(BASE_ISO);
  });

  it('group_name 为 null 或缺失时输出 null', () => {
    const nullGroup = parseStatus(
      makeStatus({ components: [makeComponent({ group_name: null })] }),
    );
    expect(at(nullGroup.components, 0).groupName).toBeNull();

    const missingGroup = makeComponent();
    delete missingGroup.group_name;
    const noGroup = parseStatus(makeStatus({ components: [missingGroup] }));
    expect(at(noGroup.components, 0).groupName).toBeNull();
  });

  it.each(['operational', 'degraded', 'outage', 'unknown'] as const)(
    '保留已知状态值 %s',
    (level) => {
      const result = parseStatus(
        makeStatus({ status: level, components: [makeComponent({ status: level })] }),
      );

      expect(result.level).toBe(level);
      expect(at(result.components, 0).level).toBe(level);
    },
  );
});

describe('parseStatus 时间线排序与截断', () => {
  it('乱序记录按时间正序输出，且保留各自状态', () => {
    const result = parseStatus(
      makeStatus({
        components: [
          makeComponent({
            timeline: [
              makePoint({ checked_at: shiftIso(20 * 60_000), status: 'operational' }),
              makePoint({ checked_at: shiftIso(-10 * 60_000), status: 'outage' }),
              makePoint({ checked_at: shiftIso(0), status: 'degraded' }),
              makePoint({ checked_at: shiftIso(-30 * 60_000), status: 'unknown' }),
            ],
          }),
        ],
      }),
    );

    const history = at(result.components, 0).history;
    expect(history.map((point) => new Date(point.checkedAt).getTime())).toEqual([
      Date.parse(shiftIso(-30 * 60_000)),
      Date.parse(shiftIso(-10 * 60_000)),
      Date.parse(BASE_ISO),
      Date.parse(shiftIso(20 * 60_000)),
    ]);
    expect(history.map((point) => point.level)).toEqual([
      'unknown',
      'outage',
      'degraded',
      'operational',
    ]);
  });

  it('超过 60 条时只保留最近 60 条', () => {
    const timeline = Array.from({ length: 65 }, (_value, index) =>
      makePoint({ checked_at: shiftIso(-index * 60_000), status: 'operational' }),
    );

    const result = parseStatus(makeStatus({ components: [makeComponent({ timeline })] }));
    const history = at(result.components, 0).history;

    expect(history).toHaveLength(60);
    // 65 条中最旧的 5 条被丢弃，保留最近 60 条。
    expect(new Date(at(history, 0).checkedAt).toISOString()).toBe(shiftIso(-59 * 60_000));
    expect(new Date(at(history, 59).checkedAt).toISOString()).toBe(shiftIso(0));
  });

  it('恰好 60 条时全部保留', () => {
    const timeline = Array.from({ length: 60 }, (_value, index) =>
      makePoint({ checked_at: shiftIso(-index * 60_000) }),
    );

    const result = parseStatus(makeStatus({ components: [makeComponent({ timeline })] }));

    expect(at(result.components, 0).history).toHaveLength(60);
  });
});

describe('parseStatus 数值 0 与缺失区分', () => {
  it('0% 与 0ms 原样保留', () => {
    const result = parseStatus(
      makeStatus({
        availability_7d: 0,
        components: [makeComponent({ availability_7d: 0, latency_ms: 0 })],
      }),
    );

    expect(result.availability).toBe(0);
    expect(at(result.components, 0).availability).toBe(0);
    expect(at(result.components, 0).latencyMs).toBe(0);
  });

  it('未知状态按缺失处理：无已知记录时可用率为 null，但 0ms 仍是 0', () => {
    const result = parseStatus(
      makeStatus({
        status: 'something-new',
        availability_7d: 0,
        components: [
          makeComponent({
            status: 'something-new',
            availability_7d: 0,
            latency_ms: 0,
            timeline: [],
          }),
        ],
      }),
    );

    // 「未知状态与数值 0 区别处理」：无已知样本时顶层可用率视为缺失，而 0ms 是有效数值必须保留。
    expect(result.level).toBe('unknown');
    expect(result.availability).toBeNull();
    expect(at(result.components, 0).availability).toBeNull();
    expect(at(result.components, 0).latencyMs).toBe(0);
  });

  it('null 的可用率/延迟保持 null，缺失的 history 为空数组', () => {
    const result = parseStatus(
      makeStatus({
        components: [
          makeComponent({
            availability_7d: null,
            latency_ms: null,
            timeline: null,
            status: 'mystery',
          }),
        ],
      }),
    );

    const component = at(result.components, 0);
    expect(component.availability).toBeNull();
    expect(component.latencyMs).toBeNull();
    expect(component.history).toEqual([]);
    expect(component.level).toBe('unknown');
  });

  it('缺失的 timeline 视为空历史', () => {
    const component = makeComponent();
    delete component.timeline;

    const result = parseStatus(makeStatus({ components: [component] }));

    expect(at(result.components, 0).history).toEqual([]);
  });
});

describe('parseStatus 空 components', () => {
  it('顶层 level 为 unknown、总 availability 为 null', () => {
    const result = parseStatus(
      makeStatus({ components: [], availability_7d: 0, status: 'operational' }),
    );

    expect(result.components).toEqual([]);
    expect(result.level).toBe('unknown');
    expect(result.availability).toBeNull();
  });

  it('components 非空但全部 unknown 且无已知历史时，总 availability 为 null（0 是默认值不是故障）', () => {
    const emptyHistory = parseStatus(
      makeStatus({
        status: 'operational',
        availability_7d: 0,
        components: [makeComponent({ status: 'mystery', availability_7d: 0, timeline: [] })],
      }),
    );
    expect(emptyHistory.components).toHaveLength(1);
    expect(emptyHistory.availability).toBeNull();

    const unknownHistory = parseStatus(
      makeStatus({
        status: 'operational',
        availability_7d: 0,
        components: [
          makeComponent({
            status: 'mystery',
            availability_7d: 0,
            timeline: [
              makePoint({ status: 'mystery', checked_at: shiftIso(-60_000) }),
              makePoint({ status: 'weird', checked_at: BASE_ISO }),
            ],
          }),
        ],
      }),
    );
    expect(unknownHistory.components).toHaveLength(1);
    expect(unknownHistory.availability).toBeNull();
  });
});

describe('parseStatus 未知状态字符串', () => {
  it('顶层与组件的未知状态都显示 unknown', () => {
    const result = parseStatus(
      makeStatus({ status: 'maintenance', components: [makeComponent({ status: 'maintenance' })] }),
    );

    expect(result.level).toBe('unknown');
    expect(at(result.components, 0).level).toBe('unknown');
  });

  it.each([undefined, null, 42, true, {}, []])('非字符串状态（%s）为 unknown', (status) => {
    const result = parseStatus(makeStatus({ status, components: [makeComponent({ status })] }));

    expect(result.level).toBe('unknown');
    expect(at(result.components, 0).level).toBe('unknown');
  });
});

describe('parseStatus 非法输入拒绝', () => {
  it.each([
    ['顶层为 null', null],
    ['顶层为数组', []],
    ['顶层为字符串', 'status'],
    ['顶层为数字', 42],
    ['components 非数组', makeStatus({ components: 'nope' })],
    [
      'components 缺失',
      (() => {
        const value = makeStatus();
        delete value.components;
        return value;
      })(),
    ],
    [
      'updated_at 缺失',
      (() => {
        const value = makeStatus();
        delete value.updated_at;
        return value;
      })(),
    ],
    ['updated_at 非字符串', makeStatus({ updated_at: 123 })],
    ['updated_at 非日期', makeStatus({ updated_at: 'yesterday' })],
    ['updated_at 日历非法', makeStatus({ updated_at: '2026-02-30T10:00:00Z' })],
    ['updated_at 月份非法', makeStatus({ updated_at: '2026-13-01T10:00:00Z' })],
    ['availability_7d 超范围', makeStatus({ availability_7d: 101 })],
    ['availability_7d 为负', makeStatus({ availability_7d: -1 })],
    ['availability_7d 为 NaN', makeStatus({ availability_7d: Number.NaN })],
    ['availability_7d 为字符串', makeStatus({ availability_7d: '99' })],
    ['组件非对象 null', makeStatus({ components: [null] })],
    ['组件非对象数字', makeStatus({ components: [42] })],
    ['组件 name 缺失', makeStatus({ components: [makeComponent({ name: undefined })] })],
    ['组件 name 为空', makeStatus({ components: [makeComponent({ name: '  ' })] })],
    ['组件 group_name 非法类型', makeStatus({ components: [makeComponent({ group_name: 7 })] })],
    ['组件 latency_ms 为负', makeStatus({ components: [makeComponent({ latency_ms: -1 })] })],
    [
      '组件 latency_ms 为 NaN',
      makeStatus({ components: [makeComponent({ latency_ms: Number.NaN })] }),
    ],
    ['组件 latency_ms 为字符串', makeStatus({ components: [makeComponent({ latency_ms: '10' })] })],
    [
      '组件 availability_7d 超范围',
      makeStatus({ components: [makeComponent({ availability_7d: 1000 })] }),
    ],
    [
      '组件 availability_7d 为负',
      makeStatus({ components: [makeComponent({ availability_7d: -0.1 })] }),
    ],
    ['timeline 非数组', makeStatus({ components: [makeComponent({ timeline: 'nope' })] })],
    ['timeline 点为 null', makeStatus({ components: [makeComponent({ timeline: [null] })] })],
    ['timeline 点为数字', makeStatus({ components: [makeComponent({ timeline: [42] })] })],
    [
      'timeline 点 checked_at 缺失',
      makeStatus({ components: [makeComponent({ timeline: [{ status: 'operational' }] })] }),
    ],
    [
      'timeline 点 checked_at 非法',
      makeStatus({
        components: [makeComponent({ timeline: [makePoint({ checked_at: 'not-a-time' })] })],
      }),
    ],
    [
      'timeline 点 checked_at 日历非法',
      makeStatus({
        components: [
          makeComponent({ timeline: [makePoint({ checked_at: '2026-02-30T10:00:00Z' })] }),
        ],
      }),
    ],
  ])('%s 时抛错', (_label, input) => {
    expect(() => parseStatus(input)).toThrow();
  });
});

describe('parseStatus 白名单与不推算', () => {
  it('额外 provider/ids/errors 不进入结果', () => {
    const result = parseStatus(
      makeStatus({
        provider: 'SENTINEL_PROVIDER',
        ids: ['SENTINEL_ID'],
        errors: ['SENTINEL_ERROR'],
        components: [
          makeComponent({
            provider: 'SENTINEL_PROVIDER',
            ids: ['SENTINEL_ID'],
            errors: ['SENTINEL_ERROR'],
            timeline: [makePoint({ provider: 'SENTINEL_PROVIDER', errors: ['SENTINEL_ERROR'] })],
          }),
        ],
      }),
    );

    expect(Object.keys(result).sort()).toEqual(
      ['availability', 'components', 'level', 'updatedAt'].sort(),
    );
    expect(Object.keys(at(result.components, 0)).sort()).toEqual(
      ['availability', 'groupName', 'history', 'latencyMs', 'level', 'name'].sort(),
    );
    expect(Object.keys(at(at(result.components, 0).history, 0)).sort()).toEqual(
      ['checkedAt', 'level'].sort(),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('SENTINEL_PROVIDER');
    expect(serialized).not.toContain('SENTINEL_ID');
    expect(serialized).not.toContain('SENTINEL_ERROR');
    expect(serialized).not.toContain('"ids"');
    expect(serialized).not.toContain('"errors"');
  });

  it('历史点不携带速度字段', () => {
    const result = parseStatus(
      makeStatus({
        components: [
          makeComponent({
            timeline: [makePoint({ latency_ms: 999, latencyMs: 999, speed: 123 })],
          }),
        ],
      }),
    );

    const point = at(at(result.components, 0).history, 0);
    expect(Object.keys(point).sort()).toEqual(['checkedAt', 'level']);
  });

  it('不根据组件历史推算总可用率：顶层缺失即为 null', () => {
    const value = makeStatus({
      components: [makeComponent({ availability_7d: 100 }), makeComponent({ availability_7d: 0 })],
    });
    delete value.availability_7d;

    const result = parseStatus(value);

    expect(result.availability).toBeNull();
  });

  it('顶层 availability_7d 缺失时保持 null，而不是补 0', () => {
    const value = makeStatus();
    delete value.availability_7d;

    const result = parseStatus(value);

    expect(result.availability).toBeNull();
  });
});
