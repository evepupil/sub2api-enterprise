/**
 * 站点级配置。品牌名 Codu，换品牌只改这里（顶栏、页脚、水印字、页面标题都从这里取）。
 */
export const SITE = {
  name: 'Codu',
  /** 页脚底部的超大水印字 */
  wordmark: 'Codu',
  /** 版权年份固定写死，避免构建与浏览器时间不一致 */
  copyrightYear: 2026,
  /** 接口地址（占位），控制台的接入示例与「复制为 curl」用 */
  apiBase: 'https://api.codu.example',
  /** 客服邮箱（Cloudflare 邮件转发到运营者邮箱）；控制台「联系我们」与页脚用 */
  supportEmail: 'support@codu.xyz',
  /** QQ 交流群号 */
  qqGroup: '1095058028',
} as const;

/**
 * 官网里还没做好的入口，首发先不显示（2026-10-07 用户定），做好后改成 true。
 * - docs：文档页还是占位。关着时顶栏、页脚、控制台侧栏都没有「文档」，直接打开 /docs 是 404。
 */
export const SITE_FEATURES: Readonly<{ docs: boolean }> = {
  docs: false,
};

export type NavKey = 'models' | 'pricing' | 'groups' | 'docs';

/** 入口开关没开的链接不显示 */
const shown = (key: string): boolean => key !== 'docs' || SITE_FEATURES.docs;

/** 顶栏菜单，顺序即显示顺序；文字取 common.nav.<key>（groups 这个键对应「通道」页） */
export const NAV_ITEMS: readonly { key: NavKey; href: string }[] = (
  [
    { key: 'models', href: '/catalog' },
    { key: 'pricing', href: '/pricing' },
    { key: 'groups', href: '/channels' },
    { key: 'docs', href: '/docs' },
  ] as const
).filter((item) => shown(item.key));

export type FooterLinkKey =
  'models' | 'pricing' | 'groups' | 'docs' | 'contact' | 'terms' | 'privacy' | 'refund';

/** 页脚三列链接；文字取 common.footer.links.<key>。「退款政策」跳到服务条款的退款一节 */
export const FOOTER_COLUMNS: readonly {
  key: 'product' | 'company' | 'legal';
  links: readonly { key: FooterLinkKey; href: string }[];
}[] = [
  {
    key: 'product',
    links: (
      [
        { key: 'models', href: '/catalog' },
        { key: 'pricing', href: '/pricing' },
        { key: 'groups', href: '/channels' },
        { key: 'docs', href: '/docs' },
      ] as const
    ).filter((link) => shown(link.key)),
  },
  {
    key: 'company',
    links: [{ key: 'contact', href: `mailto:${SITE.supportEmail}` }],
  },
  {
    key: 'legal',
    links: [
      { key: 'terms', href: '/terms' },
      { key: 'privacy', href: '/privacy' },
      { key: 'refund', href: '/terms#refund' },
    ],
  },
];
