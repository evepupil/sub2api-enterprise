/**
 * M0 导航业务规则测试（Vitest，Node 环境）。
 *
 * 契约来源：DESIGN.md 第 4 章「共用签名」。
 * 只断言导航的业务规则，不对视觉、className、组件渲染或整个对象做快照。
 *
 * 导航事实：
 * - 所有身份：概览 /console、密钥 /console/keys、用量 /console/usage、
 *   设置 /console/settings、帮助 /help。
 * - personal / owner 追加余额订单 /console/billing。
 * - owner 追加组织成员 /console/team 与组织用量 /console/team/usage。
 * - member 不显示付款或组织管理入口，但保留自身用量 /console/usage。
 *
 * 活跃判断：忽略 query/hash 与尾斜杠；/console 仅精确匹配；其余为精确或以
 * href + "/" 开头，避免 /console/keys-old 命中密钥。父子都匹配时由外壳取最长项。
 */
import { describe, expect, it } from 'vitest';

import { getConsoleNavigation, isNavigationActive } from '../src/lib/navigation';
import type { Audience } from '../src/lib/navigation';

const AUDIENCES = ['personal', 'owner', 'member'] as const satisfies readonly Audience[];

/** 三种身份共同拥有的入口。 */
const COMMON_HREFS = [
  '/console',
  '/console/keys',
  '/console/usage',
  '/console/settings',
  '/help',
] as const;
/** owner 独有的两项组织（团队）入口。 */
const OWNER_ONLY_HREFS = ['/console/team', '/console/team/usage'] as const;
/** 余额订单入口。 */
const BILLING_HREF = '/console/billing';

const EXPECTED_HREFS: Record<Audience, readonly string[]> = {
  personal: [...COMMON_HREFS, BILLING_HREF],
  owner: [...COMMON_HREFS, BILLING_HREF, ...OWNER_ONLY_HREFS],
  member: [...COMMON_HREFS],
};

function hrefsFor(audience: Audience): string[] {
  return getConsoleNavigation(audience).map((item) => item.href);
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function expectActive(pathname: string, href: string, expected: boolean): void {
  const detail = `isNavigationActive(${JSON.stringify(pathname)}, ${JSON.stringify(href)})`;
  expect(isNavigationActive(pathname, href), detail).toBe(expected);
}

// ---------------------------------------------------------------------------
// 各身份的导航入口集合
// ---------------------------------------------------------------------------

describe('getConsoleNavigation 入口范围', () => {
  it.each(AUDIENCES)('%s 的入口与约定完全一致，且没有多余入口', (audience) => {
    expect(sorted(hrefsFor(audience))).toEqual(sorted(EXPECTED_HREFS[audience]));
  });

  it.each(AUDIENCES)('%s 的每个入口都是合法 NavigationItem', (audience) => {
    const items = getConsoleNavigation(audience);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.href.startsWith('/'), `href ${item.href} 应以 / 开头`).toBe(true);
      expect(item.label.trim().length, `href ${item.href} 应有非空标签`).toBeGreaterThan(0);
    }
  });

  it.each(AUDIENCES)('%s 的 href 互不重复', (audience) => {
    const hrefs = hrefsFor(audience);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(AUDIENCES)('%s 始终包含概览、密钥、用量、设置与帮助', (audience) => {
    const hrefs = hrefsFor(audience);
    for (const href of COMMON_HREFS) {
      expect(hrefs, `${audience} 应包含 ${href}`).toContain(href);
    }
  });

  it('personal 有余额但没有组织入口', () => {
    const hrefs = hrefsFor('personal');
    expect(hrefs).toContain(BILLING_HREF);
    for (const href of OWNER_ONLY_HREFS) {
      expect(hrefs, `personal 不应包含 ${href}`).not.toContain(href);
    }
  });

  it('owner 有余额和两项组织入口', () => {
    const hrefs = hrefsFor('owner');
    expect(hrefs).toContain(BILLING_HREF);
    for (const href of OWNER_ONLY_HREFS) {
      expect(hrefs, `owner 应包含 ${href}`).toContain(href);
    }
  });

  it('member 没有余额和组织管理，但保留自身用量', () => {
    const hrefs = hrefsFor('member');
    expect(hrefs).not.toContain(BILLING_HREF);
    expect(hrefs).not.toContain('/console/team');
    expect(hrefs).not.toContain('/console/team/usage');
    expect(hrefs).toContain('/console/usage');
  });

  it('身份是唯一输入：同一身份重复调用结果一致', () => {
    for (const audience of AUDIENCES) {
      expect(sorted(hrefsFor(audience))).toEqual(sorted(hrefsFor(audience)));
    }
  });

  it('修改返回项不污染后续调用或其他身份的同一入口', () => {
    // 以概览入口为例：它在三种身份中共用，最容易被共享对象污染。
    const overview = getConsoleNavigation('personal').find((item) => item.href === '/console');
    expect(overview).toBeDefined();
    if (!overview) return;
    const originalHref = overview.href;
    const originalLabel = overview.label;

    overview.href = '/console/hacked';
    overview.label = '被改写的概览';

    const personalAgain = getConsoleNavigation('personal').find(
      (item) => item.href === originalHref,
    );
    expect(personalAgain, 'personal 再次调用应仍返回原概览入口').toBeDefined();
    expect(personalAgain?.href).toBe(originalHref);
    expect(personalAgain?.label).toBe(originalLabel);

    for (const audience of ['owner', 'member'] as const) {
      const shared = getConsoleNavigation(audience).find((item) => item.href === originalHref);
      expect(shared, `${audience} 的概览入口应保持原值`).toBeDefined();
      expect(shared?.href).toBe(originalHref);
      expect(shared?.label).toBe(originalLabel);
    }
  });
});

// ---------------------------------------------------------------------------
// isNavigationActive 路径匹配
// ---------------------------------------------------------------------------

describe('isNavigationActive 路径规范化', () => {
  it('query 不影响匹配', () => {
    expectActive('/console/keys?tab=recent', '/console/keys', true);
    expectActive('/console/team/usage?range=7d', '/console/team', true);
    expectActive('/console?tab=overview', '/console', true);
    expectActive('/console/usage?from=2026-09-01', '/console/usage', true);
  });

  it('hash 不影响匹配', () => {
    expectActive('/console/keys#recent', '/console/keys', true);
    expectActive('/console/usage#chart', '/console/usage', true);
    expectActive('/help#faq', '/help', true);
  });

  it('query 与 hash 组合不影响匹配', () => {
    expectActive('/console/keys/?tab=recent#top', '/console/keys', true);
    expectActive('/console/team/usage?range=7d#detail', '/console/team/usage', true);
  });

  it('尾斜杠不影响匹配（两侧都忽略）', () => {
    expectActive('/console/keys/', '/console/keys', true);
    expectActive('/console/keys', '/console/keys/', true);
    expectActive('/console/', '/console', true);
    expectActive('/console/team/usage/', '/console/team/usage', true);
    expectActive('/console/team/usage/', '/console/team', true);
  });
});

describe('isNavigationActive /console 仅精确命中', () => {
  it('命中概览自身', () => {
    expectActive('/console', '/console', true);
    expectActive('/console/', '/console', true);
    expectActive('/console?tab=overview', '/console', true);
  });

  it('不在任何 /console 子路径命中概览', () => {
    expectActive('/console/keys', '/console', false);
    expectActive('/console/keys/new', '/console', false);
    expectActive('/console/usage', '/console', false);
    expectActive('/console/billing', '/console', false);
    expectActive('/console/team', '/console', false);
    expectActive('/console/team/usage', '/console', false);
    expectActive('/console/settings', '/console', false);
  });
});

describe('isNavigationActive 子路径匹配', () => {
  it('/console/keys/new 命中密钥', () => {
    expectActive('/console/keys/new', '/console/keys', true);
    expectActive('/console/keys/new?step=2', '/console/keys', true);
  });

  it('/console/keys-old 不命中密钥', () => {
    expectActive('/console/keys-old', '/console/keys', false);
    expectActive('/console/keys-old', '/console', false);
  });

  it('相似前缀不误匹配其它入口', () => {
    expectActive('/console/settings-old', '/console/settings', false);
    expectActive('/console/usage-old', '/console/usage', false);
    expectActive('/console/billing-old', '/console/billing', false);
    expectActive('/console/team-old', '/console/team', false);
    expectActive('/help-old', '/help', false);
  });

  it('/console/team/usage 命中自身，也命中父路径 /console/team', () => {
    expectActive('/console/team/usage', '/console/team/usage', true);
    expectActive('/console/team/usage', '/console/team', true);
    expectActive('/console/team/usage/2026-09', '/console/team/usage', true);
    expectActive('/console/team/usage/2026-09', '/console/team', true);
    expectActive('/console/team/members', '/console/team', true);
  });

  it('/help/article 是帮助的后代', () => {
    expectActive('/help/article', '/help', true);
    expectActive('/help/article/getting-started', '/help', true);
    expectActive('/help', '/help', true);
  });
});

describe('isNavigationActive 不相关路径', () => {
  it('互不相关或根路径返回 false', () => {
    expectActive('/console/keys', '/console/usage', false);
    expectActive('/console/team', '/console/billing', false);
    expectActive('/help', '/console', false);
    expectActive('/console', '/help', false);
    expectActive('/', '/console', false);
    expectActive('/console', '/', false);
  });
});

describe('isNavigationActive 根路径', () => {
  it("href='/' 只命中根路径", () => {
    expectActive('/', '/', true);
    expectActive('/?ref=x', '/', true);
    expectActive('/#top', '/', true);
  });

  it('非根路径不命中根', () => {
    expectActive('/catalog', '/', false);
    expectActive('/catalog/models', '/', false);
    expectActive('/console', '/', false);
    expectActive('/help', '/', false);
  });
});
