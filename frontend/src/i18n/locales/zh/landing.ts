export default {
  batchImageGuide: {
    title: '图片批量生成',
    description: '一次提交多条提示词，任务完成后可统一下载图片结果'
  },
  // Home Page
  home: {
    // 以下几个键在密钥用量页和法务文档页也在用，改名要同步
    viewDocs: '查看文档',
    docs: '文档',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    dashboard: '控制台',
    login: '登录',
    goToDashboard: '进入控制台',
    register: '注册',

    hero: {
      eyebrow: '企业 AI 模型接入',
      title: '每一次调用，都记在某个人名下',
      description:
        '团队共用一套模型服务。谁调的、用了多少、花了多少钱，逐条落到成员和密钥上，额度和权限按组织下发。',
      start: '开始接入'
    },

    ledger: {
      title: '调用流水',
      caption: '调用流水示意：每一行是一次调用，含成员、分组、用量和费用',
      disclaimer: '示意数据，用于说明记录的粒度',
      total: '本页合计',
      col: {
        time: '时间',
        member: '成员',
        group: '分组',
        tokens: 'Tokens',
        latency: '耗时',
        cost: '费用'
      },
      group: {
        default: '默认分组',
        enterprise: '企业专属',
        image: '图像生成'
      }
    },

    capabilities: {
      unified: {
        label: '接口',
        title: '一个地址',
        desc: '兼容 OpenAI 与 Anthropic 的请求格式，现有代码改一个地址就能切过来。'
      },
      routing: {
        label: '调度',
        title: '自动换线',
        desc: '同一个模型下挂多个上游账号，出问题自动切走，调用方无感。'
      },
      metering: {
        label: '计费',
        title: '按量结算',
        desc: '每次调用按实际用量扣减，余额和额度实时更新，用尽即停。'
      },
      records: {
        label: '记录',
        title: '逐条留存',
        desc: '时间、分组、耗时、用量、费用逐条落库，按成员和时间范围可查。'
      }
    },

    governance: {
      eyebrow: '组织治理',
      title: '钱和权限，按组织下发',
      isolation: {
        title: '组织隔离',
        desc: '成员只看得到本组织的数据，密钥和用量互不可见。'
      },
      quota: {
        title: '成员额度',
        desc: '给每个成员设消费上限，也可以按总额批量均分。一个人用尽只停他一个，不影响同事。'
      },
      scope: {
        title: '分组授权',
        desc: '平台决定一个组织能用哪些模型分组，成员建密钥时只能从授权范围里选。'
      },
      suspend: {
        title: '整组停用',
        desc: '一个开关停掉整个组织的调用。成员账号保留各自状态，恢复时不会把你单独停过的人一起放回来。'
      }
    },

    scope: {
      caption: '组织额度示意：组织总额之下，每个成员各有上限',
      org: '组织',
      pool: '组织余额',
      granted: '已授权分组',
      denied: '未授权',
      stopped: '额度用尽，已停止调用'
    },

    integration: {
      eyebrow: '接入',
      title: '改一个地址',
      description: '把请求地址指向平台，鉴权头换成平台密钥，其余不动。返回体保持原样。',
      request: '请求',
      returned: '这次调用同时被记下',
      fields: {
        organization: { name: 'organization', note: '归属组织' },
        member: { name: 'member', note: '发起调用的成员' },
        group: { name: 'group', note: '命中的模型分组' },
        usage: { name: 'usage', note: '输入、输出与缓存 token' },
        cost: { name: 'cost', note: '本次实际费用' }
      }
    },

    personal: {
      title: '个人也能用',
      description: '不需要组织。注册后直接建密钥开始调用，同样按量计费。'
    },

    footer: {
      allRightsReserved: '保留所有权利。'
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
