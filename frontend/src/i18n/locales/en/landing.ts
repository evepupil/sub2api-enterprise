export default {
  batchImageGuide: {
    title: 'Batch Image Generation',
    description: 'Submit multiple prompts in one job and download the generated images when complete'
  },
  // Home Page
  home: {
    // These keys are also used by the key usage page and the legal document page
    viewDocs: 'View docs',
    docs: 'Docs',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    dashboard: 'Console',
    login: 'Sign in',
    goToDashboard: 'Open console',
    register: 'Sign up',

    hero: {
      eyebrow: 'AI model access for teams',
      title: 'Every call has someone’s name on it',
      description:
        'Your team shares one set of model services. Who called, how much they used and what it cost lands on a member and a key, while budgets and permissions come down from the organisation.',
      start: 'Get started'
    },

    ledger: {
      title: 'Call log',
      caption: 'Call log sample: each row is one call, with member, group, usage and cost',
      disclaimer: 'Sample data, shown to illustrate the level of detail recorded',
      total: 'Shown here',
      col: {
        time: 'Time',
        member: 'Member',
        group: 'Group',
        tokens: 'Tokens',
        latency: 'Latency',
        cost: 'Cost'
      },
      group: {
        default: 'Default',
        enterprise: 'Enterprise',
        image: 'Image'
      }
    },

    capabilities: {
      unified: {
        label: 'Endpoint',
        title: 'One base URL',
        desc: 'Speaks the OpenAI and Anthropic request formats, so existing code only changes where it points.'
      },
      routing: {
        label: 'Routing',
        title: 'Fails over',
        desc: 'A model can sit behind several upstream accounts. Traffic moves off a failing one on its own.'
      },
      metering: {
        label: 'Billing',
        title: 'Metered',
        desc: 'Each call settles against real usage. Balance and limits update as it happens, and calls stop when they run out.'
      },
      records: {
        label: 'History',
        title: 'Kept per call',
        desc: 'Time, group, latency, usage and cost are stored per call, searchable by member and date range.'
      }
    },

    governance: {
      eyebrow: 'Organisation control',
      title: 'Budgets and access come from the organisation',
      isolation: {
        title: 'Isolated by organisation',
        desc: 'Members see only their own organisation. Keys and usage stay invisible to everyone else.'
      },
      quota: {
        title: 'Per-member budgets',
        desc: 'Set a cap per member, or split a total evenly across several. One member running out stops only that member.'
      },
      scope: {
        title: 'Scoped model access',
        desc: 'The platform decides which model groups an organisation may use; members can only pick from what was granted.'
      },
      suspend: {
        title: 'Suspend a whole organisation',
        desc: 'One switch stops every call from an organisation. Member accounts keep their own status, so resuming never re-enables someone you had disabled on purpose.'
      }
    },

    scope: {
      caption: 'Budget sample: members hold their own caps under the organisation total',
      org: 'Organisation',
      pool: 'Organisation balance',
      granted: 'Granted groups',
      denied: 'Not granted',
      stopped: 'Budget spent, calls stopped'
    },

    integration: {
      eyebrow: 'Integration',
      title: 'Change one URL',
      description:
        'Point the base URL at the platform and swap the auth header for a platform key. Nothing else changes, and the response body stays as it was.',
      request: 'Request',
      returned: 'Recorded alongside the call',
      fields: {
        organization: { name: 'organization', note: 'Owning organisation' },
        member: { name: 'member', note: 'Member who made the call' },
        group: { name: 'group', note: 'Model group it resolved to' },
        usage: { name: 'usage', note: 'Input, output and cached tokens' },
        cost: { name: 'cost', note: 'What this call cost' }
      }
    },

    personal: {
      title: 'Individuals too',
      description:
        'No organisation required. Sign up, create a key and start calling, metered the same way.'
    },

    footer: {
      allRightsReserved: 'All rights reserved.'
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
