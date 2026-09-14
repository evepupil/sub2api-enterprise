export default {
  batchImageGuide: {
    title: 'Batch Image Generation',
    description: 'Submit multiple prompts in one job and download the generated images when complete'
  },
  // Home Page
  home: {
    viewDocs: 'View docs',
    docs: 'Docs',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    dashboard: 'Console',
    login: 'Sign in',
    goToDashboard: 'Open console',
    footer: {
      allRightsReserved: 'All rights reserved.'
    }
  },

  // ── Public service status ────────────────────────────
  status: {
    loading: 'Loading service status',
    unavailable: 'The status page is not available',
    noMonitors: 'No monitors have been published yet',
    window: '{days}-day window',
    summary: {
      availability: 'Availability, last {days} days',
      monitors: 'Monitors operational'
    },
    metric: {
      availability: 'Availability',
      ping: 'Network',
      latency: 'Response'
    },
    updatedAt: 'Updated {time}',
    barLabel: 'Availability of {name} over the last {days} days',
    note: 'Status comes from monitors configured by the operator, probing at a set interval. Availability covers the last 7 days, each cell on the bar is one probe, and the page is cached for about a minute.',
    overall: {
      operational: 'All services operational',
      degraded: 'Degraded performance',
      outage: 'Partial outage',
      unknown: 'Not enough data'
    },
    level: {
      operational: 'Operational',
      degraded: 'Degraded',
      outage: 'Outage',
      unknown: 'No data'
    }
  },

  // ── Marketing site (home + pricing) ──────────────────
  // Specification register, not conversational copy.
  landing: {
    nav: {
      product: 'Platform',
      scenarios: 'Scenarios',
      pricing: 'Pricing',
      models: 'Model prices',
      status: 'Status',
      docs: 'Documentation',
      login: 'Sign in',
      console: 'Console',
      tryNow: 'Get started',
      lightMode: 'Switch to light mode',
      darkMode: 'Switch to dark mode'
    },

    home: {
      eyebrow: 'AI MODEL GATEWAY · ENTERPRISE',
      title: 'Unified access · Organisation control · Security',
      lede: 'An AI model gateway built for organisational scale. Models are reached through one endpoint with redundant routing, budgets and permissions are issued through an organisation account model, request content passes a security layer, and every call is retained for audit.',
      tryNow: 'Get started',
      viewModels: 'Model prices'
    },

    console: {
      caption: 'Console sample: spend overview, call volume and call detail',
      disclaimer: 'Interface sample, figures are not measurements',
      org: 'acme.io',
      range: 'Last 30 days',
      trend: 'Calls · last 14 days',
      healthy: 'Upstreams nominal',
      metric: {
        spend: 'Spend',
        spendNote: '+12% MoM',
        calls: 'Calls',
        callsNote: '99.4% success',
        members: 'Members',
        membersNote: '3 added'
      },
      col: { member: 'Member', group: 'Group', tokens: 'Tokens', cost: 'Cost' },
      group: { default: 'Default', enterprise: 'Enterprise', image: 'Image' }
    },

    price: {
      eyebrow: 'Pricing',
      title: 'Published rates and billing rules',
      note: 'Model prices, the applied multiplier and budget drawdown rules are all published. Individual accounts are self-serve; organisation pricing is set on volume.',
      personal: { tag: 'Individual', desc: 'Settled at a fixed multiple of the published model price. Self-serve after signup.', more: 'View pricing' },
      enterprise: { tag: 'Organisation', value: 'Set on volume', desc: 'Adds organisation management, budget allocation and usage audit on top of the individual plan.', more: 'View pricing' },
      models: { tag: 'Model prices', value: 'Listed per model', desc: 'Input, output and cache prices are listed per model, so cost can be calculated before integration.', more: 'Open catalogue' }
    },

    governance: {
      eyebrow: 'Organisation control',
      title: 'Budgets and permissions issued per organisation',
      note: 'Organisations, members, budgets and scope are native platform objects rather than an overlay on a single-user model. Owners allocate limits and scope; members call within what they hold, and one exceeding a limit does not affect the others.',
      isolation: { tag: 'ISOLATION', title: 'Organisation isolation', desc: 'Data is isolated per organisation; members cannot see keys or usage records belonging to any other.' },
      budget: { tag: 'BUDGET', title: 'Budget allocation', desc: 'Set a spending limit per member, or divide an organisation total evenly. An exhausted budget stops only that member.' },
      scope: { tag: 'SCOPE', title: 'Scope grants', desc: 'The model groups available to an organisation are configured platform-side; members cannot exceed the granted scope when creating keys.' },
      suspend: { tag: 'SUSPEND', title: 'Organisation suspension', desc: 'A single switch suspends calling for the whole organisation. Member account status is retained independently, so resuming preserves any individual suspensions.' }
    },

    scope: {
      caption: 'Budget structure: members hold individual limits under the organisation total',
      org: 'Organisation',
      pool: 'Organisation balance',
      granted: 'Granted groups',
      denied: 'Not granted',
      stopped: 'Budget exhausted, calls stopped'
    },

    capabilities: {
      eyebrow: 'Platform',
      title: 'Enterprise capabilities',
      note: 'Built around organisation accounts, security, model coverage and service availability. Baseline parameters such as formats, keys and permissions are in the specification table.',
      organization: {
        title: 'Organisation accounts',
        desc: 'Organisations, members, budgets, scope grants and suspension are native platform features. Members draw on a shared organisation balance under individual caps, and one member exceeding a cap does not affect the team.'
      },
      firewall: {
        title: 'Security firewall',
        desc: 'A security layer ahead of the call path, inspecting request content for credentials, personal data and sensitive material, with policy configured per organisation.'
      },
      coverage: {
        title: 'Unified model access',
        figure: '{models} models · {groups} groups',
        desc: 'Text, image and other model types behind one endpoint, with per-model prices published and verifiable in the catalogue.'
      },
      availability: {
        title: 'Redundant routing',
        desc: 'A single group carries multiple upstream accounts, failing over automatically and isolating the faulty account, transparently to the caller.'
      },
      latency: {
        title: 'Low-overhead forwarding',
        desc: 'The gateway performs authentication, routing and metering only. Streaming responses pass through unmodified, with no added buffering or rewriting.'
      },
      deploy: {
        title: 'Standalone deployment',
        desc: 'Deployable inside customer infrastructure for data residency and network isolation requirements, with upgrade and operations arrangements agreed separately.'
      }
    },

    spec: {
      eyebrow: 'Specification',
      title: 'Integration and runtime parameters',
      note: 'Current platform implementation, provided as a basis for technical evaluation.',
      rows: {
        protocol: { label: 'Formats', value: 'OpenAI Chat Completions / Anthropic Messages' },
        auth: { label: 'Authentication', value: 'Bearer token (platform-issued key)' },
        stream: { label: 'Streaming', value: 'Supported, upstream stream passed through' },
        quota: { label: 'Budget tiers', value: 'Organisation balance / member limit / per-key quota' },
        precision: { label: 'Billing precision', value: '8 decimal places' },
        settle: { label: 'Settlement', value: 'Drawn down per call; no prepayment or minimum' },
        records: { label: 'Record grain', value: 'Per call (member, key, group, usage, cost, latency)' },
        export: { label: 'Export', value: 'By member and date range' },
        deploy: { label: 'Deployment', value: 'Hosted / standalone' }
      }
    },

    steps: {
      eyebrow: 'Integration',
      title: 'Three steps',
      note: 'No changes to application logic, and no upstream account per member.',
      create: { title: 'Create a key', desc: 'Create a key in the console, specify its groups, and configure quota and rate limit as needed.' },
      point: { title: 'Change the URL', desc: 'Point the base URL at the platform and replace the auth header with the platform key. Everything else is unchanged.' },
      allocate: { title: 'Allocate budget', desc: 'Invite members into the organisation and set a limit each, or divide a total across them.' },
      request: 'Request',
      compatible: 'OpenAI / Anthropic',
      returned: 'Recorded with the call',
      fields: {
        organization: { name: 'organization', note: 'Owning organisation' },
        member: { name: 'member', note: 'Calling member' },
        group: { name: 'group', note: 'Resolved group' },
        usage: { name: 'usage', note: 'Input / output / cached tokens' },
        cost: { name: 'cost', note: 'Cost of this call' },
        latency: { name: 'latency', note: 'Upstream latency' }
      }
    },

    service: {
      eyebrow: 'Service',
      title: 'Service and data assurances',
      note: 'Enterprise integration and pricing enquiries:',
      mailSubject: 'Enterprise integration enquiry',
      items: {
        support: { title: 'Support', desc: 'Email support on the individual plan. Organisations are additionally assigned a named contact covering integration, scaling and incidents.' },
        isolation: { title: 'Data ownership', desc: 'Call records belong to the customer organisation and export in a standard format. Member changes or suspension do not affect the queryability of existing records.' },
        retention: { title: 'Retention', desc: 'Call records are retained for the configured period and exportable by member and date range for reconciliation.' },
        selfhost: { title: 'Deployment', desc: 'Hosted by default. Where data residency or network isolation is required, standalone deployment is available; arranged over email.' }
      }
    },

    cases: {
      eyebrow: 'Scenarios',
      title: 'Typical integration scenarios',
      note: 'Placeholder examples, grouped by industry and team size.',
      items: {
        crossBorder: 'Cross-border retail',
        crossBorderScale: '40 people · 12 keys',
        crossBorderUsage: 'Product copy and support replies generated in bulk, grouped by business line so cost is apportioned per group.',
        saas: 'SaaS product',
        saasScale: '25 people · environment split',
        saasUsage: 'Development and production hold separate keys and groups, so test overspend does not reach live traffic.',
        agency: 'Digital content',
        agencyScale: '60 people · key per project',
        agencyUsage: 'One key per project, with project cost derived from that key at closeout.',
        education: 'Online education',
        educationScale: '15 people · text and image',
        educationUsage: 'Courseware illustration and lesson text sit in separate groups, exported monthly for reconciliation.'
      }
    },

    closer: {
      title: 'Start integrating',
      desc: 'Model prices and the multiplier are published, so cost can be calculated up front. Individual accounts are self-serve; the organisation plan adds organisation accounts, security and a named contact, priced on volume.',
      contact: 'Contact sales'
    },

    footer: {
      blurb: 'An enterprise AI model gateway. Unified access across model services, with budgets and permissions issued per organisation.',
      product: 'Product',
      account: 'Account',
      contact: 'Contact',
      register: 'Sign up',
      rights: 'All rights reserved.'
    }
  },

  // ── Pricing page ─────────────────────────────────────
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pricing and billing rules',
    lede: 'Model prices are published and settled at the multiplier for the plan. Balance and budgets are drawn down as each call completes, with no prepayment and no minimum.',

    personal: {
      name: 'Individual',
      for: 'For solo developers and small teams, self-serve',
      rateUnit: 'of the model price',
      rateNote: 'Applied to the prices published in the model catalogue.',
      cta: 'Sign up',
      points: {
        models: 'All configured models, in OpenAI and Anthropic request formats',
        keys: 'Multiple concurrent keys, each with its own quota and rate limit',
        records: 'Per-call records retained and searchable by date range',
        usage: 'Usage and cost reporting with export',
        support: 'Email support'
      }
    },

    enterprise: {
      name: 'Organisation',
      for: 'For multi-member teams requiring attribution and access control',
      quote: 'Set on volume',
      quoteNote: 'Adds organisation control on top of the individual plan. Price is set against usage volume and arranged over email.',
      cta: 'Email us',
      mailSubject: 'Enterprise integration enquiry',
      points: {
        everything: 'Everything in the individual plan',
        members: 'Organisation and member management with invitation codes',
        budgets: 'Member spending limits, divisible from an organisation total',
        scope: 'Model group scope configured per organisation',
        suspend: 'Organisation-level suspension with member account status retained',
        contact: 'Named contact covering integration and incident handling'
      }
    },

    compare: {
      eyebrow: 'Compare',
      title: 'Capability comparison',
      note: 'Calling capability is identical across plans. The difference lies in organisation control and usage visibility.',
      capability: 'Capability',
      groups: {
        calling: 'Calling',
        billing: 'Billing',
        org: 'Organisation control',
        records: 'Records and support'
      },
      rows: {
        formats: 'OpenAI / Anthropic request formats',
        groups: 'Model groups available',
        failover: 'Automatic upstream failover',
        keyQuota: 'Per-key quota and rate limit',
        rate: 'Multiplier',
        metered: 'Settled on actual usage',
        payer: 'Charged to',
        members: 'Organisation and member management',
        budgets: 'Member spending limits',
        split: 'Budget division across members',
        suspend: 'Organisation-level suspension',
        invite: 'Invitation-code signup',
        perCall: 'Per-call record retention',
        scopeOfUsage: 'Usage visibility',
        export: 'Record export',
        support: 'Technical support'
      },
      values: {
        platformDefault: 'Platform default groups',
        perOrg: 'Configured per organisation',
        negotiated: 'Set on volume',
        self: 'Own balance',
        orgOwner: 'Owner balance',
        selfOnly: 'Own usage only',
        wholeOrg: 'All members',
        email: 'Email',
        dedicated: 'Email and named contact'
      }
    },

    billing: {
      eyebrow: 'Billing',
      title: 'Cost composition and settlement',
      note: 'Input, output and cache prices are published per model.',
      viewModels: 'Open the model catalogue',
      rules: {
        metered: {
          title: 'Basis',
          desc: 'Charged on the actual token usage of each call. No monthly package and no minimum; calls not made are not billed.'
        },
        precision: {
          title: 'Precision',
          desc: 'Costs are recorded to eight decimal places, so rounding does not inflate the cost of an individual call.'
        },
        realtime: {
          title: 'Settlement point',
          desc: 'Balance and budgets are drawn down as each call completes rather than at month end. An exhausted budget refuses subsequent requests, so no arrears accrue.'
        },
        rate: {
          title: 'Multiplier',
          desc: 'Final cost is the model price multiplied by the plan multiplier. Fixed for the individual plan and set against volume for organisations.'
        },
        payer: {
          title: 'Charged to',
          desc: 'Individual accounts draw on their own balance. Organisation usage is covered by the owner balance, with a spending limit set per member.'
        }
      }
    },

    faq: {
      eyebrow: 'Questions',
      title: 'Questions raised before integration',
      note: 'For anything else, contact:',
      items: {
        switch: {
          q: 'How much code needs to change?',
          a: 'Two things: the base URL and the auth header. Request and response structures are unchanged, in either the OpenAI or the Anthropic form.'
        },
        overspend: {
          q: 'Can a member exceed their budget?',
          a: 'No. Budgets are verified before a call and drawn down after it, and an exhausted budget refuses subsequent requests. One member running out affects only that member.'
        },
        leak: {
          q: 'How is a leaked key handled?',
          a: 'Revoke that key in the console; other keys are unaffected. Assigning each key its own quota limits the exposure of a single leaked key to that quota.'
        },
        invoice: {
          q: 'Are invoices available?',
          a: 'Yes on the organisation plan, with billing details arranged over email. Individual accounts requiring an invoice may also contact us by email.'
        }
      }
    }
  },

  // Key Usage Query Page
  keyUsage: {
    title: 'API Key Usage',
    subtitle: 'Enter your API Key to view real-time spending and usage status',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: 'Query',
    querying: 'Querying...',
    privacyNote: 'Your Key is processed locally in the browser and will not be stored',
    dateRange: 'Date Range:',
    dateRangeToday: 'Today',
    dateRange7d: '7 Days',
    dateRange30d: '30 Days',
    dateRange90d: '90 Days',
    dateRangeCustom: 'Custom',
    apply: 'Apply',
    used: 'Used',
    detailInfo: 'Detail Information',
    tokenStats: 'Token Statistics',
    dailyDetail: 'Daily Detail',
    modelStats: 'Model Usage Statistics',
    // Table headers
    date: 'Date',
    model: 'Model',
    requests: 'Requests',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    cacheCreationTokens: 'Cache Creation',
    cacheReadTokens: 'Cache Read',
    cacheWriteTokens: 'Cache Write',
    totalTokens: 'Total Tokens',
    cost: 'Cost',
    // Status
    quotaMode: 'Key Quota Mode',
    walletBalance: 'Wallet Balance',
    // Ring card titles
    totalQuota: 'Total Quota',
    limit5h: '5-Hour Limit',
    limitDaily: 'Daily Limit',
    limit7d: '7-Day Limit',
    limitWeekly: 'Weekly Limit',
    limitMonthly: 'Monthly Limit',
    // Detail rows
    remainingQuota: 'Remaining Quota',
    expiresAt: 'Expires At',
    todayExpires: '(expires today)',
    daysLeft: '({days} days)',
    usedQuota: 'Used Quota',
    resetNow: 'Resetting soon',
    subscriptionType: 'Subscription Type',
    subscriptionExpires: 'Subscription Expires',
    // Usage stat cells
    todayRequests: 'Today Requests',
    todayInputTokens: 'Today Input',
    todayOutputTokens: 'Today Output',
    todayTokens: 'Today Tokens',
    todayCacheCreation: 'Today Cache Creation',
    todayCacheRead: 'Today Cache Read',
    todayCost: 'Today Cost',
    rpmTpm: 'RPM / TPM',
    totalRequests: 'Total Requests',
    totalInputTokens: 'Total Input',
    totalOutputTokens: 'Total Output',
    totalTokensLabel: 'Total Tokens',
    totalCacheCreation: 'Total Cache Creation',
    totalCacheRead: 'Total Cache Read',
    totalCost: 'Total Cost',
    avgDuration: 'Avg Duration',
    // Messages
    enterApiKey: 'Please enter an API Key',
    querySuccess: 'Query successful',
    queryFailed: 'Query failed',
    queryFailedRetry: 'Query failed, please try again later',
    noDailyUsage: 'No daily usage data',
  },

  // Setup Wizard
  setup: {
    title: 'Sub2API Setup',
    description: 'Configure your Sub2API instance',
    database: {
      title: 'Database Configuration',
      description: 'Connect to your PostgreSQL database',
      host: 'Host',
      port: 'Port',
      username: 'Username',
      password: 'Password',
      databaseName: 'Database Name',
      sslMode: 'SSL Mode',
      passwordPlaceholder: 'Password',
      ssl: {
        disable: 'Disable',
        require: 'Require',
        verifyCa: 'Verify CA',
        verifyFull: 'Verify Full'
      }
    },
    redis: {
      title: 'Redis Configuration',
      description: 'Connect to your Redis server',
      host: 'Host',
      port: 'Port',
      username: 'Username (optional)',
      password: 'Password (optional)',
      database: 'Database',
      usernamePlaceholder: 'Leave empty for default user',
      passwordPlaceholder: 'Password',
      enableTls: 'Enable TLS',
      enableTlsHint: 'Use TLS when connecting to Redis (public CA certs)'
    },
    admin: {
      title: 'Admin Account',
      description: 'Create your administrator account',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      passwordPlaceholder: 'Min 8 characters',
      confirmPasswordPlaceholder: 'Confirm password',
      passwordMismatch: 'Passwords do not match'
    },
    ready: {
      title: 'Ready to Install',
      description: 'Review your configuration and complete setup',
      database: 'Database',
      redis: 'Redis',
      adminEmail: 'Admin Email'
    },
    status: {
      testing: 'Testing...',
      success: 'Connection Successful',
      testConnection: 'Test Connection',
      installing: 'Installing...',
      completeInstallation: 'Complete Installation',
      completed: 'Installation completed!',
      redirecting: 'Redirecting to login page...',
      restarting: 'Service is restarting, please wait...',
      timeout: 'Service restart is taking longer than expected. Please refresh the page manually.'
    }
  },

  // Common
}
