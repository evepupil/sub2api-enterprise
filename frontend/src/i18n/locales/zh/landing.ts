export default {
  batchImageGuide: {
    title: '图片批量生成',
    description: '一次提交多条提示词，任务完成后可统一下载图片结果'
  },
  // Home Page
  home: {
    viewDocs: '查看文档',
    docs: '文档',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    dashboard: '控制台',
    login: '登录',
    goToDashboard: '进入控制台',
    footer: {
      allRightsReserved: '保留所有权利。'
    }
  },

  // ── 对外服务状态页 ────────────────────────────────────
  status: {
    loading: '正在读取服务状态',
    unavailable: '服务状态页暂未开放',
    noMonitors: '管理员尚未配置对外公示的监测项',
    window: '窗口 {days} 天',
    summary: {
      availability: '近 {days} 天可用率',
      monitors: '监测项正常数'
    },
    metric: {
      availability: '可用率',
      ping: '链路延迟',
      latency: '响应延迟'
    },
    updatedAt: '更新于 {time}',
    barLabel: '{name} 近 {days} 天的可用状态',
    note: '状态来自管理员配置的渠道监测，按设定间隔主动探测。可用率为近 7 天统计，状态条每格对应一次探测，页面缓存约一分钟。',
    overall: {
      operational: '服务运行正常',
      degraded: '部分服务性能下降',
      outage: '部分服务不可用',
      unknown: '暂无足够数据'
    },
    level: {
      operational: '正常',
      degraded: '性能下降',
      outage: '不可用',
      unknown: '无数据'
    }
  },

  // ── 官网（首页 + 定价页）──────────────────────────────
  // 文案一律名词化、书面语。企业官网是规格说明，不是对话。
  landing: {
    nav: {
      product: '产品能力',
      scenarios: '应用场景',
      pricing: '产品定价',
      models: '模型价格',
      status: '服务状态',
      docs: '接入文档',
      login: '登录',
      console: '控制台',
      tryNow: '立即体验',
      lightMode: '切换到浅色模式',
      darkMode: '切换到深色模式'
    },

    home: {
      eyebrow: 'AI 模型网关 · 企业版',
      title: '统一接入 · 组织管控 · 安全防护',
      lede: '面向企业规模使用的 AI 模型网关。多模型统一接入并冗余调度，组织账户体系下发配额与权限，调用内容经前置安全层检查，全量记录可审计。',
      tryNow: '立即体验',
      viewModels: '模型价格'
    },

    console: {
      caption: '组织控制台示意：消费概览、调用趋势与调用明细',
      disclaimer: '界面示意，数据非实测',
      org: '组织 acme.io',
      range: '近 30 天',
      trend: '调用量 · 近 14 天',
      healthy: '上游链路正常',
      metric: {
        spend: '本月消费',
        spendNote: '环比 +12%',
        calls: '调用次数',
        callsNote: '成功率 99.4%',
        members: '活跃成员',
        membersNote: '本月新增 3'
      },
      col: { member: '成员', group: '分组', tokens: 'Tokens', cost: '费用' },
      group: { default: '默认分组', enterprise: '企业专属', image: '图像生成' }
    },

    price: {
      eyebrow: '产品定价',
      title: '计费规则与单价公开',
      note: '模型单价、计费倍率与配额扣减规则均对外公开。个人版自助开通，企业版按用量核定。',
      personal: { tag: '个人版', desc: '按模型单价乘以固定倍率结算，注册后自助开通。', more: '查看定价' },
      enterprise: { tag: '企业版', value: '按用量核定', desc: '在个人版能力基础上增加组织管理、配额分配与用量审计。', more: '查看定价' },
      models: { tag: '模型价格', value: '逐项公开', desc: '各模型输入、输出与缓存单价逐项列示，接入前可完成成本测算。', more: '进入模型广场' }
    },

    governance: {
      eyebrow: '组织管控',
      title: '配额与权限按组织分级下发',
      note: '组织、成员、配额与授权范围为平台原生对象，非在单用户体系上附加。管理员分配额度与可用范围，成员在授权内调用，单人超限不影响其他成员。',
      isolation: { tag: 'ISOLATION', title: '组织隔离', desc: '数据按组织隔离，成员不可见其他组织的密钥与用量记录。' },
      budget: { tag: 'BUDGET', title: '配额分配', desc: '支持为成员单独设定消费上限，或按组织总额批量均分。单个成员配额耗尽仅停止该成员调用。' },
      scope: { tag: 'SCOPE', title: '分组授权', desc: '组织可用的模型分组范围由平台侧配置，成员创建密钥时不可超出授权范围。' },
      suspend: { tag: 'SUSPEND', title: '统一停用', desc: '单一开关停用整个组织的调用权限，成员账号状态独立保留，恢复时不影响原有个体停用设置。' }
    },

    scope: {
      caption: '配额结构示意：组织总额之下，成员各自持有上限',
      org: '组织',
      pool: '组织余额',
      granted: '已授权分组',
      denied: '未授权',
      stopped: '配额耗尽，调用已停止'
    },

    capabilities: {
      eyebrow: '平台能力',
      title: '企业级核心能力',
      note: '围绕组织账户、安全防护、模型覆盖与服务可用性构建。接入协议、密钥与权限等基础参数见技术规格。',
      organization: {
        title: '组织账户体系',
        desc: '组织、成员、配额、分组授权与统一停用为平台原生能力。成员共用组织余额，各自持有消费上限，单人超限不影响团队。'
      },
      firewall: {
        title: '安全防火墙',
        desc: '调用链前置安全层，对请求内容执行密钥、个人信息与敏感内容的识别与处置，按组织维度配置策略。'
      },
      coverage: {
        title: '多模型统一接入',
        figure: '{models} 个模型 · {groups} 个分组',
        desc: '文本、图像等多类模型统一接入，单价逐项公开，可在模型广场直接核对。'
      },
      availability: {
        title: '多账号冗余调度',
        desc: '单一分组挂载多个上游账号，异常自动切换并隔离故障账号，切换过程对调用方无感知。'
      },
      latency: {
        title: '低开销转发',
        desc: '网关仅做鉴权、路由与计量，流式响应原样透传，不引入额外缓冲与改写。'
      },
      deploy: {
        title: '独立部署',
        desc: '支持在客户自有环境独立部署，满足数据驻留与网络隔离要求，升级与运维方案单独约定。'
      }
    },

    spec: {
      eyebrow: '技术规格',
      title: '接入与运行参数',
      note: '以下参数为平台当前实现，可作为技术选型依据。',
      rows: {
        protocol: { label: '接入协议', value: 'OpenAI Chat Completions / Anthropic Messages' },
        auth: { label: '鉴权方式', value: 'Bearer Token（平台签发密钥）' },
        stream: { label: '流式响应', value: '支持，透传上游流式输出' },
        quota: { label: '配额层级', value: '组织余额 / 成员上限 / 单密钥配额' },
        precision: { label: '计费精度', value: '小数点后 8 位' },
        settle: { label: '结算方式', value: '按调用实时扣减，无预付与最低消费' },
        records: { label: '记录粒度', value: '单次调用（含成员、密钥、分组、用量、费用、耗时）' },
        export: { label: '数据导出', value: '支持按成员与时间范围导出' },
        deploy: { label: '部署方式', value: '公有云托管 / 独立部署' }
      }
    },

    steps: {
      eyebrow: '接入流程',
      title: '三步完成接入',
      note: '无需改动业务逻辑，无需为成员单独申请上游账号。',
      create: { title: '创建密钥', desc: '于控制台创建密钥，指定可用分组，按需配置配额与速率限制。' },
      point: { title: '变更地址', desc: '将请求地址指向平台，鉴权头替换为平台密钥，其余保持不变。' },
      allocate: { title: '分配配额', desc: '邀请成员加入组织，逐个设定消费上限或按总额批量均分。' },
      request: '请求示例',
      compatible: 'OpenAI / Anthropic',
      returned: '同步记录字段',
      fields: {
        organization: { name: 'organization', note: '归属组织' },
        member: { name: 'member', note: '调用成员' },
        group: { name: 'group', note: '命中分组' },
        usage: { name: 'usage', note: '输入 / 输出 / 缓存 token' },
        cost: { name: 'cost', note: '本次费用' },
        latency: { name: 'latency', note: '上游耗时' }
      }
    },

    service: {
      eyebrow: '服务保障',
      title: '服务与数据保障',
      note: '企业接入与报价咨询：',
      mailSubject: '企业版接入咨询',
      items: {
        support: { title: '技术支持', desc: '个人版提供邮件支持。企业版另行配置专属对接人，覆盖接入、扩容与故障排查。' },
        isolation: { title: '数据归属', desc: '调用记录归属客户组织，支持标准格式导出。成员变更或组织停用不影响既有记录的可查询性。' },
        retention: { title: '记录留存', desc: '调用记录按平台配置周期留存，支持按成员与时间范围导出核对。' },
        selfhost: { title: '部署方式', desc: '默认公有云托管。存在数据驻留或网络隔离要求的，支持独立部署，具体方案邮件协商。' }
      }
    },

    cases: {
      eyebrow: '应用场景',
      title: '典型接入场景',
      note: '以下为占位示例，按行业与团队规模归类。',
      items: {
        crossBorder: '跨境电商',
        crossBorderScale: '40 人 · 12 密钥',
        crossBorderUsage: '商品文案与客服应答批量生成，按业务线划分分组，费用分摊至各组。',
        saas: 'SaaS 产品',
        saasScale: '25 人 · 环境隔离',
        saasUsage: '研发与生产使用独立密钥与分组，测试超支不影响线上调用。',
        agency: '数字内容',
        agencyScale: '60 人 · 按项目建密钥',
        agencyUsage: '单项目单密钥，结项时依据密钥用量核算项目成本。',
        education: '在线教育',
        educationScale: '15 人 · 图文混合',
        educationUsage: '课件插图与讲义文本分属不同分组，按月导出核对。'
      }
    },

    closer: {
      title: '开始接入',
      desc: '模型单价与计费倍率对外公开，可先行完成成本测算。个人版注册后自助开通，企业版含组织账户、安全防护与专属对接，按用量核定报价。',
      contact: '企业咨询'
    },

    footer: {
      blurb: '企业级 AI 模型统一接入网关。多模型统一接入，配额与权限按组织分级下发。',
      product: '产品',
      account: '账号',
      contact: '联系',
      register: '注册',
      rights: '保留所有权利。'
    }
  },

  // ── 定价页 ────────────────────────────────────────────
  pricing: {
    eyebrow: '产品定价',
    title: '定价与计费规则',
    lede: '模型单价对外公开，按版本对应倍率结算。余额与配额于调用完成时实时扣减，无预付与最低消费。',

    personal: {
      name: '个人版',
      for: '面向个人开发者与小型团队，自助开通',
      rateUnit: '模型单价',
      rateNote: '以模型广场公示单价为基准，乘以该倍率结算。',
      cta: '注册开通',
      points: {
        models: '全部已配置模型，支持 OpenAI 与 Anthropic 请求格式',
        keys: '多密钥并行，单密钥可独立配置配额与速率限制',
        records: '调用记录逐条留存，支持按时间范围检索',
        usage: '用量与费用统计，支持导出',
        support: '邮件技术支持'
      }
    },

    enterprise: {
      name: '企业版',
      for: '面向多成员团队，需分账归属与权限管控',
      quote: '按用量核定',
      quoteNote: '在个人版能力基础上增加组织管控。价格随用量规模核定，通过邮件协商。',
      cta: '邮件咨询',
      mailSubject: '企业版接入咨询',
      points: {
        everything: '包含个人版全部能力',
        members: '组织与成员管理，支持邀请码注册',
        budgets: '成员消费上限，支持按组织总额批量均分',
        scope: '按组织配置可用模型分组范围',
        suspend: '组织级停用开关，成员账号状态独立保留',
        contact: '专属对接人，覆盖接入与故障排查'
      }
    },

    compare: {
      eyebrow: '版本对照',
      title: '能力对照',
      note: '调用能力两版一致，差异集中于组织管控与用量可见范围。',
      capability: '能力项',
      groups: {
        calling: '调用',
        billing: '计费',
        org: '组织管控',
        records: '记录与支持'
      },
      rows: {
        formats: 'OpenAI / Anthropic 请求格式',
        groups: '可用模型分组',
        failover: '上游异常自动切换',
        keyQuota: '单密钥配额与速率限制',
        rate: '计费倍率',
        metered: '按实际用量结算',
        payer: '费用承担方',
        members: '组织与成员管理',
        budgets: '成员消费上限',
        split: '配额批量均分',
        suspend: '组织级停用',
        invite: '邀请码注册',
        perCall: '调用记录逐条留存',
        scopeOfUsage: '用量可见范围',
        export: '记录导出',
        support: '技术支持'
      },
      values: {
        platformDefault: '平台默认开放分组',
        perOrg: '按组织配置',
        negotiated: '按用量核定',
        self: '本人余额',
        orgOwner: '组织管理员余额',
        selfOnly: '仅本人',
        wholeOrg: '全组织成员',
        email: '邮件',
        dedicated: '邮件与专属对接人'
      }
    },

    billing: {
      eyebrow: '计费规则',
      title: '费用构成与结算方式',
      note: '各模型输入、输出与缓存单价逐项公示。',
      viewModels: '进入模型广场',
      rules: {
        metered: {
          title: '计费口径',
          desc: '以单次调用的实际 token 用量为准，无包月套餐与最低消费，未产生调用不计费。'
        },
        precision: {
          title: '计费精度',
          desc: '费用记账保留至小数点后八位，单次调用成本不因舍入而放大。'
        },
        realtime: {
          title: '结算时点',
          desc: '余额与配额于调用完成时即时扣减，非月末统一结算。配额耗尽时拒绝后续请求，不产生欠费。'
        },
        rate: {
          title: '倍率适用',
          desc: '最终费用为模型单价与版本倍率之积。个人版倍率固定，企业版按用量规模核定。'
        },
        payer: {
          title: '费用承担',
          desc: '个人版扣减本人余额。企业版由组织管理员余额统一承担，各成员另设消费上限。'
        }
      }
    },

    faq: {
      eyebrow: '常见问题',
      title: '接入前的常见问题',
      note: '其他问题请联系：',
      items: {
        switch: {
          q: '接入需要改动多少代码？',
          a: '仅需变更请求地址与鉴权头两处。请求体与响应体结构保持不变，兼容 OpenAI 与 Anthropic 两种写法。'
        },
        overspend: {
          q: '成员是否可能超出配额？',
          a: '不会。配额在调用前校验、调用后扣减，耗尽时拒绝后续请求。单个成员配额耗尽仅影响该成员，同组其他成员不受影响。'
        },
        leak: {
          q: '密钥泄露如何处理？',
          a: '在控制台吊销该密钥即可，其余密钥不受影响。为单个密钥配置独立配额，可将泄露造成的损失限定在该配额以内。'
        },
        invoice: {
          q: '是否提供发票？',
          a: '企业版提供，开票信息通过邮件对接。个人版的开票需求同样可邮件联系。'
        }
      }
    }
  },

  // Key Usage Query Page
  keyUsage: {
    title: 'API Key 用量查询',
    subtitle: '输入您的 API Key 以查看实时消费金额与使用状态',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: '查询',
    querying: '查询中...',
    privacyNote: '您的 Key 仅在浏览器本地处理，不会被存储',
    dateRange: '统计范围:',
    dateRangeToday: '今日',
    dateRange7d: '7 天',
    dateRange30d: '30 天',
    dateRange90d: '90 天',
    dateRangeCustom: '自定义',
    apply: '应用',
    used: '已使用',
    detailInfo: '详细信息',
    tokenStats: 'Token 统计',
    dailyDetail: '按日明细',
    modelStats: '模型用量统计',
    // Table headers
    date: '日期',
    model: '模型',
    requests: '请求数',
    inputTokens: '输入 Tokens',
    outputTokens: '输出 Tokens',
    cacheCreationTokens: '缓存创建',
    cacheReadTokens: '缓存读取',
    cacheWriteTokens: '缓存写入',
    totalTokens: '总 Tokens',
    cost: '费用',
    // Status
    quotaMode: 'Key 限额模式',
    walletBalance: '钱包余额',
    // Ring card titles
    totalQuota: '总额度',
    limit5h: '5 小时限额',
    limitDaily: '日限额',
    limit7d: '7 天限额',
    limitWeekly: '周限额',
    limitMonthly: '月限额',
    // Detail rows
    remainingQuota: '剩余额度',
    expiresAt: '过期时间',
    todayExpires: '(今日到期)',
    daysLeft: '({days} 天)',
    usedQuota: '已用额度',
    resetNow: '即将重置',
    subscriptionType: '订阅类型',
    subscriptionExpires: '订阅到期',
    // Usage stat cells
    todayRequests: '今日请求',
    todayInputTokens: '今日输入',
    todayOutputTokens: '今日输出',
    todayTokens: '今日 Tokens',
    todayCacheCreation: '今日缓存创建',
    todayCacheRead: '今日缓存读取',
    todayCost: '今日费用',
    rpmTpm: 'RPM / TPM',
    totalRequests: '累计请求',
    totalInputTokens: '累计输入',
    totalOutputTokens: '累计输出',
    totalTokensLabel: '累计 Tokens',
    totalCacheCreation: '累计缓存创建',
    totalCacheRead: '累计缓存读取',
    totalCost: '累计费用',
    avgDuration: '平均耗时',
    // Messages
    enterApiKey: '请输入 API Key',
    querySuccess: '查询成功',
    queryFailed: '查询失败',
    queryFailedRetry: '查询失败，请稍后重试',
    noDailyUsage: '暂无按日用量数据',
  },

  // Setup Wizard
  setup: {
    title: 'Sub2API 安装向导',
    description: '配置您的 Sub2API 实例',
    database: {
      title: '数据库配置',
      description: '连接到您的 PostgreSQL 数据库',
      host: '主机',
      port: '端口',
      username: '用户名',
      password: '密码',
      databaseName: '数据库名称',
      sslMode: 'SSL 模式',
      passwordPlaceholder: '密码',
      ssl: {
        disable: '禁用',
        require: '要求',
        verifyCa: '验证 CA',
        verifyFull: '完全验证'
      }
    },
    redis: {
      title: 'Redis 配置',
      description: '连接到您的 Redis 服务器',
      host: '主机',
      port: '端口',
      username: '用户名（可选）',
      password: '密码（可选）',
      database: '数据库',
      usernamePlaceholder: '默认用户留空',
      passwordPlaceholder: '密码',
      enableTls: '启用 TLS',
      enableTlsHint: '连接 Redis 时使用 TLS（公共 CA 证书）'
    },
    admin: {
      title: '管理员账户',
      description: '创建您的管理员账户',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      passwordPlaceholder: '至少 8 个字符',
      confirmPasswordPlaceholder: '确认密码',
      passwordMismatch: '密码不匹配'
    },
    ready: {
      title: '准备安装',
      description: '检查您的配置并完成安装',
      database: '数据库',
      redis: 'Redis',
      adminEmail: '管理员邮箱'
    },
    status: {
      testing: '测试中...',
      success: '连接成功',
      testConnection: '测试连接',
      installing: '安装中...',
      completeInstallation: '完成安装',
      completed: '安装完成！',
      redirecting: '正在跳转到登录页面...',
      restarting: '服务正在重启，请稍候...',
      timeout: '服务重启时间超出预期，请手动刷新页面。'
    }
  },

  // Common
}
