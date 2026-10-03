/**
 * 站点级配置。品牌名是占位，换品牌只改这里（顶栏、页脚、水印字、页面标题都从这里取）。
 */
export const SITE = {
  name: 'Nexus API',
  /** 页脚底部的超大水印字 */
  wordmark: 'NEXUS API',
  /** 版权年份固定写死，避免构建与浏览器时间不一致 */
  copyrightYear: 2026,
} as const;

export type NavKey = 'models' | 'pricing' | 'groups' | 'docs';

/** 顶栏菜单，顺序即显示顺序；文字取 common.nav.<key> */
export const NAV_ITEMS: readonly { key: NavKey; href: string }[] = [
  { key: 'models', href: '/models' },
  { key: 'pricing', href: '/pricing' },
  { key: 'groups', href: '/groups' },
  { key: 'docs', href: '/docs' },
];

export type FooterLinkKey =
  | 'models'
  | 'pricing'
  | 'groups'
  | 'docs'
  | 'about'
  | 'contact'
  | 'status'
  | 'terms'
  | 'privacy'
  | 'refund';

/** 页脚三列链接；文字取 common.footer.links.<key>，'#' 为占位 */
export const FOOTER_COLUMNS: readonly {
  key: 'product' | 'company' | 'legal';
  links: readonly { key: FooterLinkKey; href: string }[];
}[] = [
  {
    key: 'product',
    links: [
      { key: 'models', href: '/models' },
      { key: 'pricing', href: '/pricing' },
      { key: 'groups', href: '/groups' },
      { key: 'docs', href: '/docs' },
    ],
  },
  {
    key: 'company',
    links: [
      { key: 'about', href: '#' },
      { key: 'contact', href: '#' },
      { key: 'status', href: '#' },
    ],
  },
  {
    key: 'legal',
    links: [
      { key: 'terms', href: '#' },
      { key: 'privacy', href: '#' },
      { key: 'refund', href: '#' },
    ],
  },
];
