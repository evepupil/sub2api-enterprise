/**
 * User-authorized fictional marketing content for the Proactiv redesign.
 * This file never supplies account balances, billing records, model prices or live status.
 * Replace the brand, showcase and customer stories here before using them as factual claims.
 */
export const marketingContent = {
  brand: { name: 'Nexus API', tagline: '连接模型，成就下一个好产品。' },
  hero: {
    eyebrow: '为下一代 AI 产品而生',
    lines: ['每一个想法', '都值得更好的模型。'],
    description:
      '把主流 AI 模型接进你的产品。一个账户管理接入、用量与团队，让每一份创造力都有稳定的起点。',
    benefits: ['一个密钥，连接多种模型', '美元计费，费用一目了然', '从个人开发到团队协作'],
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
  platform: [
    {
      title: '你熟悉的模型，一个接入点',
      description: '统一管理多个模型的调用入口，切换选择，让灵感少等一步。',
      kind: 'routing',
      href: '/catalog',
    },
    {
      title: '每一笔用量，都有答案',
      description: '按模型、日期与密钥查看请求、Token 和费用。',
      kind: 'analytics',
      href: '/console/usage',
    },
    {
      title: '密钥各司其职',
      description: '为不同应用分配密钥，随时调整额度与有效期。',
      kind: 'keys',
      href: '/console/keys',
    },
    {
      title: '把团队放在同一张账单里',
      description: '统一余额、分配成员配额，让协作和预算一起清晰。',
      kind: 'team',
      href: '/console/team',
    },
    {
      title: '连接状况，公开可见',
      description: '可用性、当前响应速度和历史记录，一处看清。',
      kind: 'status',
      href: '/status',
    },
  ],
  workspace: {
    title: '把精力留给产品，\n把复杂交给我们。',
    description: '从一个人的创意，到一个团队的日常。接入、协作和费用管理，都在同一个工作空间。',
    points: [
      '按项目管理密钥，各自独立',
      '按成员分配配额，支出有边界',
      '按日期查看用量，数据能对上',
    ],
    analyticsTitle: '看清每一次调用的价值。',
    analyticsDescription:
      '不用在不同平台之间来回找账单。模型分布、Token 构成和消费趋势，帮助你做出下一步选择。',
  },
  scenarios: [
    {
      id: 'coding',
      label: '编程与研发',
      title: '让想法更快成为可运行的代码。',
      description: '从理解旧项目、编写功能到检查改动，为研发过程选择合适的模型。',
      tasks: ['在编辑器里完成代码理解与重构', '为不同项目独立分配调用密钥'],
      tags: ['代码助手', '项目隔离', '多模型选择'],
      screenTitle: '研发工作空间',
      prompt: '帮我为这个应用补齐登录流程',
      result: '已整理接口约定、页面状态与实现步骤。',
      model: 'Claude Sonnet',
      items: ['理解项目结构', '完成登录与错误处理', '检查会话恢复'],
    },
    {
      id: 'agents',
      label: '智能体与应用',
      title: '把模型能力，放进你的业务流程。',
      description: '知识问答、任务执行、内容提取，连接你已有的应用与自动化工具。',
      tasks: ['为问答与复杂任务选择不同模型', '查看应用用量，持续调整调用成本'],
      tags: ['智能体', '知识问答', '应用集成'],
      screenTitle: '客户知识助手',
      prompt: '整理本周用户最关心的三个问题',
      result: '已从知识库整理高频主题与参考资料。',
      model: 'GPT',
      items: ['检索相关知识', '归纳问题与依据', '生成回复草稿'],
    },
    {
      id: 'content',
      label: '内容与知识',
      title: '把零散信息，变成值得分享的内容。',
      description: '让研究、整理和写作拥有同一个起点，把时间留给判断与表达。',
      tasks: ['整理长文档，提取观点与素材', '从选题草稿走到多种表达版本'],
      tags: ['长文本', '研究整理', '内容创作'],
      screenTitle: '内容工作空间',
      prompt: '把这份研究整理成一篇清晰的文章',
      result: '已完成结构、核心论点和待核实资料。',
      model: 'Gemini',
      items: ['梳理研究材料', '组织论据与结构', '生成文章初稿'],
    },
  ],
  pricing: [
    {
      title: '个人开发',
      subtitle: '让第一个想法轻装上阵',
      label: '按量使用',
      href: '/register',
      action: '开始使用',
      features: ['一个余额，调用多种模型', '独立密钥与有效期管理', '随时查看请求与消费'],
    },
    {
      title: '团队协作',
      subtitle: '让每一份投入都有边界',
      label: '统一余额',
      href: '/console/team',
      action: '进入工作台',
      features: ['管理员统一管理组织余额', '为成员分配可用配额', '按成员查看组织用量'],
    },
    {
      title: '费用透明',
      subtitle: '用清楚的价格做决定',
      label: '四维定价',
      href: '/catalog',
      action: '查看模型价格',
      features: ['输入与输出分别计费', '缓存写入与读取单独展示', '美元计价，明细可查询'],
    },
  ],
  stories: [
    {
      company: '北辰实验室',
      mark: '北',
      category: 'AI 应用',
      quote:
        '我们把多个模型放进同一套产品流程。每周看一次模型用量和费用，就能决定哪些任务值得换一个选择。',
      name: '陈亦舟',
      role: '联合创始人',
      result: '3 个产品',
      resultLabel: '共用一个工作空间',
    },
    {
      company: '简序工作室',
      mark: '简',
      category: '独立开发',
      quote:
        '项目密钥分开以后，终于能看清每个小产品的实际成本。一个人也可以把研发和账单管理得很从容。',
      name: '林序',
      role: '独立开发者',
      result: '6 个项目',
      resultLabel: '分别管理调用密钥',
    },
    {
      company: '澜图科技',
      mark: '澜',
      category: '团队协作',
      quote:
        '给研发、运营和内容同事各自分配额度，大家按需要选模型。管理员在一处就能看到团队整体支出。',
      name: '许知遥',
      role: '产品负责人',
      result: '12 位成员',
      resultLabel: '协作在同一个账户',
    },
    {
      company: '拾光内容',
      mark: '拾',
      category: '内容创作',
      quote:
        '研究时用长文本模型，写作时换成更适合表达的模型。工具还是原来的工具，创作过程顺畅了很多。',
      name: '周乐宁',
      role: '内容主理人',
      result: '4 类工作流',
      resultLabel: '串起研究与表达',
    },
    {
      company: '观山数据',
      mark: '观',
      category: '知识工程',
      quote:
        '我们把客户知识助手接进统一入口，按密钥追踪不同应用。遇到问题先看状态和用量，排查路径更清楚。',
      name: '顾行远',
      role: '技术负责人',
      result: '8 个助手',
      resultLabel: '各自保留用量明细',
    },
    {
      company: '向量工场',
      mark: '向',
      category: '产品研发',
      quote:
        '试验阶段能快速切换模型，进入稳定运行后又能认真核对费用。这让我们可以把更多精力放在用户体验上。',
      name: '苏予安',
      role: '工程经理',
      result: '一个入口',
      resultLabel: '连接整个研发流程',
    },
  ],
  integrations: ['Cursor', 'Claude Code', 'Cline', 'Open WebUI', 'LobeChat', '自建应用'],
  faqs: [
    {
      question: '如何开始使用？',
      answer:
        '创建账户后，在控制台生成密钥、充值余额，再按照接入文档配置工具。模型目录会列出当前可用的模型与价格。',
    },
    {
      question: '需要订阅套餐吗？',
      answer:
        '当前采用余额按量计费。你可以在控制台查看余额、订单和实际消费，按自己的使用节奏安排支出。',
    },
    {
      question: '四项模型价格分别是什么？',
      answer:
        '输入、缓存写入、缓存读取和输出分别展示，单位为美元 / 百万 Token。不同模型的缓存支持情况和价格以模型目录及实际调用记录为准。',
    },
    {
      question: '团队成员如何使用余额？',
      answer:
        '组织管理员统一管理余额，并为成员设置配额。成员在配额范围内使用，管理员可以在组织用量中查看各成员的消费。',
    },
    {
      question: '可以接入我正在使用的工具吗？',
      answer:
        '支持配置兼容 API 地址和密钥的工具，可以按接入文档进行配置。工具所用协议与模型需要匹配，具体方式见帮助中心。',
    },
    {
      question: '在哪里查看服务状态和历史记录？',
      answer:
        '服务状态页公开展示可用率、最近一次响应耗时，以及已有的历史可用性记录。缺少探测结果时会明确显示，历史记录的范围以页面实际标注为准。',
    },
  ],
} as const;
