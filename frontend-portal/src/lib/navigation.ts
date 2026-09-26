/**
 * M0 导航规则（纯函数，服务端与客户端均可用）。
 *
 * 契约来源：DESIGN.md 第 4 章「共用签名」。
 * 注意：导航只决定界面展示哪些入口，不承担鉴权；真实权限在 M2/M4 后端核对，
 * 不得凭前端身份向后端请求未授权的数据。
 */

/** 门户身份：仅这三种，平台角色不属于导航身份。 */
export type Audience = 'personal' | 'owner' | 'member';

/** 导航图标约定集合。 */
export type NavigationIcon = 'overview' | 'key' | 'usage' | 'wallet' | 'team' | 'settings' | 'help';

/** 单条控制台导航项。 */
export interface NavigationItem {
  href: string;
  label: string;
  icon: NavigationIcon;
}

const ITEM_OVERVIEW: NavigationItem = { href: '/console', label: '概览', icon: 'overview' };
const ITEM_KEYS: NavigationItem = { href: '/console/keys', label: '密钥', icon: 'key' };
const ITEM_USAGE: NavigationItem = { href: '/console/usage', label: '用量', icon: 'usage' };
const ITEM_BILLING: NavigationItem = {
  href: '/console/billing',
  label: '余额订单',
  icon: 'wallet',
};
const ITEM_TEAM: NavigationItem = { href: '/console/team', label: '组织成员', icon: 'team' };
const ITEM_TEAM_USAGE: NavigationItem = {
  href: '/console/team/usage',
  label: '组织用量',
  icon: 'usage',
};
const ITEM_SETTINGS: NavigationItem = {
  href: '/console/settings',
  label: '设置',
  icon: 'settings',
};
const ITEM_HELP: NavigationItem = { href: '/help', label: '帮助', icon: 'help' };

/**
 * 按身份返回完整导航列表。
 *
 * - 全部身份：概览、密钥、用量、设置、帮助。
 * - personal / owner：追加余额订单。
 * - owner：再追加组织成员、组织用量。
 * - member：不出现付款或组织管理入口。
 *
 * 每次返回新数组，调用方可安全修改而不影响其他调用。
 */
export function getConsoleNavigation(audience: Audience): NavigationItem[] {
  switch (audience) {
    case 'personal':
      return [ITEM_OVERVIEW, ITEM_KEYS, ITEM_USAGE, ITEM_BILLING, ITEM_SETTINGS, ITEM_HELP].map(
        (item) => ({ ...item }),
      );
    case 'owner':
      return [
        ITEM_OVERVIEW,
        ITEM_KEYS,
        ITEM_USAGE,
        ITEM_BILLING,
        ITEM_TEAM,
        ITEM_TEAM_USAGE,
        ITEM_SETTINGS,
        ITEM_HELP,
      ].map((item) => ({ ...item }));
    case 'member':
      return [ITEM_OVERVIEW, ITEM_KEYS, ITEM_USAGE, ITEM_SETTINGS, ITEM_HELP].map((item) => ({
        ...item,
      }));
  }
}

/** 去掉 query/hash 与末尾斜杠（根路径 "/" 保留），用于活跃判断。 */
function normalizePath(value: string): string {
  let path = value;
  const cut = path.search(/[?#]/);
  if (cut !== -1) {
    path = path.slice(0, cut);
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

/**
 * 判断导航项是否对应当前路径。
 *
 * - 忽略 query、hash 与两侧尾斜杠。
 * - `/` 与 `/console` 仅精确匹配。
 * - 其他项为精确匹配，或当前路径以 `href + "/"` 开头，
 *   因此 `/console/keys-old` 不会命中 `/console/keys`。
 * - 父子同时命中时由外壳取最长匹配项作为唯一当前项，本函数不裁决。
 */
export function isNavigationActive(pathname: string, href: string): boolean {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (target === '/' || target === '/console') {
    return current === target;
  }
  return current === target || current.startsWith(`${target}/`);
}
