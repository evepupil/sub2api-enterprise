import { EDITION_IDS, getEdition } from './editions';
import type { EditionId, Localized, ModelType } from './types';

/**
 * 分组（占位数据）。每个版本下有四个分组，实际扣费 = 模型基础价 × 分组倍率。
 * 模型页、价格页展示的版本价格，取该版本的默认分组：文本模型用「通用」，生图模型用「生图」。
 */
export type GroupKind = 'general' | 'image' | 'claude' | 'priority' | 'custom';

export interface Group {
  id: string;
  edition: EditionId;
  kind: GroupKind;
  name: Localized;
  /** 分组倍率；null 表示按合同定制 */
  ratio: number | null;
  description: Localized;
  /** 可用模型范围 */
  scope: Localized;
  /** 适用的模型类型 */
  modelTypes: readonly ModelType[];
  /** 本分组独有的特权，卡片里排在版本通用特权之后 */
  extras: readonly Localized[];
  /** 卡片是否用深色重点样式（每个版本一张） */
  featured: boolean;
  cta: 'register' | 'contact';
}

const NAMES: Record<GroupKind, Localized> = {
  general: { zh: '通用', en: 'General' },
  image: { zh: '生图', en: 'Image' },
  claude: { zh: 'Claude 专线', en: 'Claude Line' },
  priority: { zh: '高速通道', en: 'Priority Lane' },
  custom: { zh: '专属定制', en: 'Dedicated' },
};

const DESCRIPTIONS: Record<GroupKind, Localized> = {
  general: { zh: '全部文本模型，一个密钥通用。', en: 'Every text model on a single key.' },
  image: {
    zh: '全部生图模型，按张或按 Token 计费。',
    en: 'Every image model, billed per image or per token.',
  },
  claude: {
    zh: '独立 Claude 账号池，适合编程工具长对话。',
    en: 'A dedicated Claude pool for long coding sessions.',
  },
  priority: {
    zh: '高峰期优先调度，延迟更低。',
    en: 'Priority scheduling with lower latency at peak hours.',
  },
  custom: {
    zh: '专属渠道与独立倍率，按合同约定。',
    en: 'Dedicated channels and ratios, set by contract.',
  },
};

const SCOPES: Record<GroupKind, Localized> = {
  general: { zh: '全部文本模型', en: 'All text models' },
  image: { zh: '全部生图模型', en: 'All image models' },
  claude: { zh: 'Claude 全系模型', en: 'All Claude models' },
  priority: { zh: '全部文本模型', en: 'All text models' },
  custom: { zh: '按需开通模型', en: 'Models on request' },
};

const EXTRAS: Record<GroupKind, readonly Localized[]> = {
  general: [{ zh: '缓存读取按官方比例计费', en: 'Cache reads billed at official ratios' }],
  image: [
    { zh: '支持图生图与局部编辑', en: 'Image-to-image and inpainting' },
    { zh: '失败请求不计费', en: 'Failed requests are not billed' },
  ],
  claude: [
    { zh: '独立 Claude 账号池', en: 'Dedicated Claude account pool' },
    { zh: '适配 Claude Code 长上下文', en: 'Tuned for long Claude Code contexts' },
  ],
  priority: [
    { zh: '高峰期优先调度', en: 'Priority scheduling at peak hours' },
    { zh: '首字延迟更低', en: 'Lower time to first token' },
  ],
  custom: [
    { zh: '专属渠道与独立倍率', en: 'Dedicated channels and ratios' },
    { zh: '可选私有化部署', en: 'Optional private deployment' },
    { zh: '合同约定可用率与赔付', en: 'Contractual availability and credits' },
  ],
};

/** 每个版本四张卡的顺序与倍率；第三张（Claude 专线）是重点卡 */
const LAYOUT: Record<EditionId, readonly { kind: GroupKind; ratio: number | null }[]> = {
  personal: [
    { kind: 'general', ratio: 1 },
    { kind: 'image', ratio: 1 },
    { kind: 'claude', ratio: 1.2 },
    { kind: 'priority', ratio: 1.5 },
  ],
  pro: [
    { kind: 'general', ratio: 1.4 },
    { kind: 'image', ratio: 1.3 },
    { kind: 'claude', ratio: 1.6 },
    { kind: 'priority', ratio: 2 },
  ],
  enterprise: [
    { kind: 'general', ratio: 2 },
    { kind: 'image', ratio: 1.8 },
    { kind: 'claude', ratio: 2.2 },
    { kind: 'custom', ratio: null },
  ],
};

const MODEL_TYPES: Record<GroupKind, readonly ModelType[]> = {
  general: ['text'],
  image: ['image'],
  claude: ['text'],
  priority: ['text'],
  custom: ['text', 'image'],
};

export const GROUPS: readonly Group[] = EDITION_IDS.flatMap((edition) =>
  LAYOUT[edition].map(({ kind, ratio }): Group => ({
    id: `${edition}-${kind}`,
    edition,
    kind,
    name: NAMES[kind],
    ratio,
    description: DESCRIPTIONS[kind],
    scope: SCOPES[kind],
    modelTypes: MODEL_TYPES[kind],
    extras: EXTRAS[kind],
    featured: kind === 'claude',
    cta: kind === 'custom' ? 'contact' : 'register',
  })),
);

export function groupsFor(edition: EditionId): Group[] {
  return GROUPS.filter((g) => g.edition === edition);
}

/** 版本价格取的默认分组：文本 → 通用，生图 → 生图 */
export function defaultGroup(edition: EditionId, type: ModelType): Group {
  const kind: GroupKind = type === 'image' ? 'image' : 'general';
  const group = GROUPS.find((g) => g.edition === edition && g.kind === kind);
  if (!group) throw new Error(`no default group for ${edition}/${type}`);
  return group;
}

/** 某版本某类模型的计价倍率 */
export function editionRatio(edition: EditionId, type: ModelType): number {
  const ratio = defaultGroup(edition, type).ratio;
  if (ratio === null) throw new Error(`default group of ${edition} has no ratio`);
  return ratio;
}

/** 特权对比表的一格：布尔值画对勾 / 横线，文本原样显示 */
export type PrivilegeCell = boolean | Localized;

export interface PrivilegeRow {
  id: string;
  label: Localized;
  values: Record<EditionId, PrivilegeCell>;
}

const yes = true;
const no = false;
const text = (zh: string, en: string = zh): Localized => ({ zh, en });
/** 倍率文字：整数补一位小数（×1.0、×2.0），其余原样（×1.4、×1.25） */
export function ratioLabel(ratio: number): string {
  return `×${Number.isInteger(ratio) ? ratio.toFixed(1) : String(ratio)}`;
}

const ratioText = (edition: EditionId, type: ModelType): Localized =>
  text(ratioLabel(editionRatio(edition, type)));
const thousands = (n: number): Localized => text(n.toLocaleString('en-US'));

/** 三个版本的特权对比（分组页对比表），倍率与额度直接从数据推出，不另写一份 */
export const PRIVILEGE_ROWS: readonly PrivilegeRow[] = [
  {
    id: 'sla',
    label: text('可用率目标', 'Availability target'),
    values: {
      personal: text(`${getEdition('personal').slaTarget.toFixed(1)}%`),
      pro: text(`${getEdition('pro').slaTarget.toFixed(1)}%`),
      enterprise: text(`${getEdition('enterprise').slaTarget.toFixed(1)}%`),
    },
  },
  {
    id: 'channel',
    label: text('渠道类型', 'Channel'),
    values: {
      personal: getEdition('personal').channel,
      pro: getEdition('pro').channel,
      enterprise: getEdition('enterprise').channel,
    },
  },
  {
    id: 'general-ratio',
    label: text('通用分组倍率', 'General group ratio'),
    values: {
      personal: ratioText('personal', 'text'),
      pro: ratioText('pro', 'text'),
      enterprise: ratioText('enterprise', 'text'),
    },
  },
  {
    id: 'image-ratio',
    label: text('生图分组倍率', 'Image group ratio'),
    values: {
      personal: ratioText('personal', 'image'),
      pro: ratioText('pro', 'image'),
      enterprise: ratioText('enterprise', 'image'),
    },
  },
  {
    id: 'rpm',
    label: text('单密钥每分钟请求数', 'Requests per minute per key'),
    values: {
      personal: thousands(getEdition('personal').rpm),
      pro: thousands(getEdition('pro').rpm),
      enterprise: thousands(getEdition('enterprise').rpm),
    },
  },
  {
    id: 'concurrency',
    label: text('并发上限', 'Concurrency limit'),
    values: {
      personal: thousands(getEdition('personal').concurrency),
      pro: thousands(getEdition('pro').concurrency),
      enterprise: thousands(getEdition('enterprise').concurrency),
    },
  },
  {
    id: 'failover',
    label: text('故障自动切换', 'Automatic failover'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'priority',
    label: text('优先调度', 'Priority scheduling'),
    values: { personal: no, pro: yes, enterprise: yes },
  },
  {
    id: 'members',
    label: text('组织成员上限', 'Organization members'),
    values: { personal: text('3'), pro: text('20'), enterprise: text('不限', 'Unlimited') },
  },
  {
    id: 'export',
    label: text('用量明细导出', 'Usage export'),
    values: { personal: yes, pro: yes, enterprise: yes },
  },
  {
    id: 'invoice',
    label: text('对公转账与发票', 'Bank transfer and invoices'),
    values: { personal: no, pro: yes, enterprise: yes },
  },
  {
    id: 'credits',
    label: text('可用率赔付', 'SLA credits'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'manager',
    label: text('专属客户经理', 'Dedicated account manager'),
    values: { personal: no, pro: no, enterprise: yes },
  },
  {
    id: 'support',
    label: text('工单响应', 'Support response'),
    values: {
      personal: text(
        `${getEdition('personal').supportHours} 小时`,
        `${getEdition('personal').supportHours} hours`,
      ),
      pro: text(
        `${getEdition('pro').supportHours} 小时`,
        `${getEdition('pro').supportHours} hours`,
      ),
      enterprise: text(
        `${getEdition('enterprise').supportHours} 小时`,
        `${getEdition('enterprise').supportHours} hour`,
      ),
    },
  },
];
