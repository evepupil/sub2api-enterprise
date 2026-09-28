/**
 * 官网营销内容集中管理（企业版定位）。
 *
 * - 能力与参数表述均按当前系统实现核实，核实结论与来源见 docs/前端设计/官网素材与动效来源.md；
 *   新增表述前先核实，不写系统做不到的事，也不写任何读取或检测调用内容的说法。
 * - dashboard 是首页控制台示意的构造数据，不代表真实运营数据；
 *   本文件不向账户、账单、目录价格或服务状态提供数据。
 */
export const marketingContent = {
  brand: { name: 'Nexus API', tagline: '企业级 AI 模型统一接入网关。' },
  hero: {
    eyebrow: 'AI 模型网关 · 企业版',
    lines: ['统一接入 · 组织管控', '高可用 · 低延迟'],
    description:
      '面向企业规模使用的 AI 模型网关：主流模型统一接入，多账号冗余调度，额度与权限按组织、成员与密钥分级下发。',
    benefits: ['多账号冗余调度', '密钥级访问控制', '单价逐项公开'],
  },
  dashboard: {
    period: '近 7 天',
    stats: [
      { label: '账户余额', value: '$286.40', icon: 'wallet' },
      { label: '请求次数', value: '48,296', icon: 'activity' },
      { label: 'Token 用量', value: '12.8M', icon: 'layers' },
      { label: '实际消费', value: '$86.72', icon: 'chart' },
    ],
    trend: [22, 38, 30, 54, 42, 67, 53, 61, 74, 62, 82, 73, 94, 85],
    models: [
      { name: 'Claude Sonnet', cost: '$42.31', percent: 49, tokens: '6.2M' },
      { name: 'GPT', cost: '$29.48', percent: 34, tokens: '4.4M' },
      { name: 'Gemini', cost: '$14.93', percent: 17, tokens: '2.2M' },
    ],
    members: [
      { name: '产品研发', initials: '研', spend: '$32.68', quota: '$120.00', percent: 27 },
      { name: '内容工作室', initials: '创', spend: '$28.24', quota: '$80.00', percent: 35 },
      { name: '应用实验室', initials: '智', spend: '$25.80', quota: '$100.00', percent: 26 },
    ],
  },
  providers: [
    { name: 'OpenAI', logo: '/providers/openai.svg', short: 'O' },
    { name: 'Anthropic', logo: '/providers/anthropic.svg', short: 'A' },
    { name: 'Google', logo: '/providers/google.svg', short: 'G' },
    { name: 'DeepSeek', logo: null, short: 'D' },
    { name: 'Qwen', logo: null, short: 'Q' },
  ],
  /** 各区块标题；区块只保留必要的一句说明，能省则省。 */
  sections: {
    showcase: {
      title: '组织控制台，',
      highlight: '用量、费用与配额一处可查',
      overview: '组织用量概览',
      costTitle: '按模型汇总',
    },
    providers: { eyebrow: '模型接入', title: '覆盖主流模型厂家' },
    capabilities: { eyebrow: '核心能力', title: '为企业规模使用而设计' },
    governance: {
      eyebrow: '组织管控',
      title: '配额与权限按组织分级下发',
    },
    models: {
      eyebrow: '模型价格',
      title: '主流模型单价逐项公开',
      description: '单位：美元 / 百万 Token',
    },
    pricing: { eyebrow: '计费方式', title: '单价与计费规则公开' },
    service: { eyebrow: '服务保障', title: '服务与数据保障' },
    faq: { eyebrow: '常见问题', title: '接入前的常见问题' },
  },
  capabilities: [
    {
      kind: 'availability',
      title: '高可用调度',
      description:
        '同一分组挂载多个上游账号，出现异常时自动切换，并临时隔离故障账号，调用方无需改动。',
    },
    {
      kind: 'latency',
      title: '低延迟转发',
      description: '流式响应按上游事件逐条转发，不整段缓冲，尽量压低中转耗时。',
    },
    {
      kind: 'access',
      title: '访问控制',
      description:
        '单个密钥可设消费额度、有效期、5 小时 / 1 天 / 7 天速率限制、IP 白名单与黑名单和可用分组。',
    },
    {
      kind: 'organization',
      title: '组织账户体系',
      description:
        '组织、成员、配额与分组授权是平台原生能力。成员各自持有消费上限，单人超限不影响团队。',
    },
    {
      kind: 'models',
      title: '多模型统一接入',
      description: '兼容 OpenAI、Anthropic 与 Gemini 协议，文本与图像模型统一计量，单价逐项公开。',
    },
    {
      kind: 'deployment',
      title: '独立部署',
      description: '支持在客户自有环境独立部署，满足数据驻留与网络隔离要求。',
    },
  ],
  governance: [
    {
      kind: 'isolation',
      title: '组织隔离',
      description: '数据按组织隔离，成员看不到其他组织的密钥与用量记录。',
    },
    {
      kind: 'budget',
      title: '配额分配',
      description:
        '为成员单独设定消费上限，或按组织总额批量均分；某位成员额度用尽，只停止该成员的调用。',
    },
    {
      kind: 'scope',
      title: '分组授权',
      description: '组织可用的模型分组由平台配置，成员创建密钥时不能超出授权范围。',
    },
    {
      kind: 'suspend',
      title: '统一停用',
      description: '一个开关停用整个组织的调用权限；恢复时，成员原有的停用设置保持不变。',
    },
  ],
  plans: [
    {
      title: '个人版',
      value: '按量计费',
      description: '按模型单价结算，余额按调用实时扣减，注册后自助开通。',
      features: ['主流模型统一接入', '密钥额度、有效期与限速自主设置', '用量与费用逐次可查'],
      href: '/register',
      action: '注册开通',
    },
    {
      title: '企业版',
      value: '按用量核定',
      description: '在个人版基础上增加组织账户、成员配额与分组授权，支持独立部署。',
      features: ['组织隔离与统一停用', '成员配额单独设定或批量均分', '专属对接人支持接入与排障'],
      href: '/help#contact-title',
      action: '联系我们',
    },
    {
      title: '模型价格',
      value: '逐项公开',
      description: '各模型输入、输出与缓存单价逐项列示，接入前即可完成成本测算。',
      features: ['输入与输出分别计价', '缓存写入与读取单独列示', '美元计价，精确到小数点后 8 位'],
      href: '/catalog',
      action: '查看模型价格',
    },
  ],
  service: [
    {
      kind: 'support',
      title: '技术支持',
      description: '个人版提供邮件支持；企业版配置专属对接人，覆盖接入、扩容与故障排查。',
    },
    {
      kind: 'ownership',
      title: '数据归属',
      description: '调用记录归属客户组织；成员变更或组织停用后，既有记录仍可查询。',
    },
    {
      kind: 'status',
      title: '状态公开',
      description: '可用率与响应耗时在服务状态页公开展示。',
    },
    {
      kind: 'deployment',
      title: '部署方式',
      description: '有数据驻留或网络隔离要求的，支持在客户环境独立部署，方案单独约定。',
    },
  ],
  faqs: [
    {
      question: '支持哪些接入协议？',
      answer:
        'OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、Gemini 原生协议以及图像生成接口，使用平台签发的密钥鉴权。',
    },
    {
      question: '费用如何计算？',
      answer:
        '按模型目录公开的单价计费，输入、输出与缓存读写分别计价。账户余额按调用实时扣减，精确到小数点后 8 位，无最低消费。',
    },
    {
      question: '组织如何分配额度？',
      answer:
        '管理员可为成员单独设定消费上限，也可按总额批量均分。某位成员额度用尽只停止该成员的调用，不影响其他成员。',
    },
    {
      question: '如何限制密钥的使用范围？',
      answer:
        '单个密钥可设置消费额度、有效期、5 小时 / 1 天 / 7 天速率限制、IP 白名单与黑名单，以及可用的模型分组。',
    },
    {
      question: '上游账号异常时会怎样？',
      answer:
        '同一分组挂载多个上游账号。某个账号异常时，网关自动切换到其他账号，并临时隔离故障账号。',
    },
    {
      question: '能否在自有环境部署？',
      answer: '支持。有数据驻留或网络隔离要求的，可在客户环境独立部署，具体方案联系我们单独约定。',
    },
  ],
  cta: {
    title: '开始接入',
    secondary: '查看模型价格',
  },
  /** 登录、注册页左侧展示区。 */
  auth: {
    title: '统一接入主流模型，按组织管控额度与权限。',
    points: [
      '多账号冗余调度，异常自动切换',
      '组织、成员与密钥分级管控额度',
      '单价逐项公开，用量逐次可查',
    ],
  },
} as const;
