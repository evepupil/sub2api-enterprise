/**
 * 官网上线前必须逐条核对的配置。
 *
 * 这些值跟语言无关，而且上线前需要有人确认，所以集中放一个文件，
 * 不散进 i18n。留空的项在页面上不渲染，不会显示占位符。
 */

/** 企业咨询邮箱。 */
export const SALES_EMAIL = 'sales@example.com'

/**
 * 页脚公司全称。留空会退回站点名。
 * 上线前必须填真实主体，国内企业客户看页脚没有主体基本直接出局。
 */
export const COMPANY_NAME = ''

/**
 * ICP 备案号。留空则页脚不显示这一行。
 * 上线前必须填。
 */
export const ICP_NUMBER = ''

/** 个人版倍率。改这里同时要改定价页的计费说明。 */
export const PERSONAL_RATE = '0.5x'

/**
 * 可用性承诺，例如 '99.9%'。
 *
 * ⚠️ 留空时能力卡只写调度机制，不出现任何可用性数字。
 * 填了就是对外承诺，客户会拿来对账，填之前先确认自己守得住。
 */
export const SLA_UPTIME = ''

/**
 * 网关自身引入的延迟，例如 'P95 < 50ms'。
 *
 * ⚠️ 留空时不显示。这个数指的是平台转发环节的开销，
 * 不含上游模型的生成时间，两者不能混着写。
 */
export const GATEWAY_LATENCY = ''

/**
 * 安全防火墙（ACF）是否对外展示。
 *
 * ⚠️ ACF 目前尚未上线。置为 true 表示在官网宣称这项能力，
 * 客户在 POC 阶段大概率会要求现场演示。上线前建议保持 false。
 */
export const SHOW_SECURITY_FIREWALL = true

/**
 * 是否提供独立部署。关掉则能力卡和服务条款里不提这件事。
 */
export const OFFERS_PRIVATE_DEPLOY = true

/**
 * 客户案例。
 *
 * ⚠️ 目前是占位内容，上线前必须换成真实案例或者清空。
 *
 * 占位只写行业和团队规模，不编公司名、不编引用语、不编效果数字——
 * 那类东西一旦上线就是伪造背书。数组清空后案例区块整块不渲染。
 */
export interface CaseStudy {
  /** 行业，走 i18n 键 */
  industryKey: string
  /** 团队规模，走 i18n 键 */
  scaleKey: string
  /** 用途，走 i18n 键 */
  usageKey: string
}

export const CASE_STUDIES: CaseStudy[] = [
  { industryKey: 'crossBorder', scaleKey: 'crossBorderScale', usageKey: 'crossBorderUsage' },
  { industryKey: 'saas', scaleKey: 'saasScale', usageKey: 'saasUsage' },
  { industryKey: 'agency', scaleKey: 'agencyScale', usageKey: 'agencyUsage' },
  { industryKey: 'education', scaleKey: 'educationScale', usageKey: 'educationUsage' }
]
