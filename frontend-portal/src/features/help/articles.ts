export interface HelpArticle {
  id: string;
  category: '接入' | '账户与用量';
  title: string;
  paragraphs: readonly string[];
  steps?: readonly string[];
}

/** 内容依据已确认的底座业务，客服地址与外部文档入口取公开设置。 */
export const helpArticles: readonly HelpArticle[] = [
  {
    id: 'getting-started',
    category: '接入',
    title: '开始接入',
    paragraphs: [
      '在模型目录选择要使用的模型，确认模型代号与价格。将账户中创建的密钥和平台提供的接入地址填写到支持相应接口的客户端。',
    ],
    steps: [
      '查看模型目录，选择模型代号。',
      '进入账户创建密钥，并设置可用范围与额度。',
      '按平台文档填写接入地址和密钥，确认余额或组织配额后开始调用。',
    ],
  },
  {
    id: 'api-keys',
    category: '接入',
    title: '管理密钥',
    paragraphs: [
      '可以为不同项目分别创建和命名密钥，设置允许范围、消费额度和有效期。停用或删除不再使用的密钥。',
      '密钥用于识别调用账户。请保存到客户端的安全配置中，避免出现在公开代码、截图或聊天记录里。',
    ],
  },
  {
    id: 'balance-quota',
    category: '账户与用量',
    title: '余额与组织配额',
    paragraphs: [
      '个人账户使用本人的余额支付调用费用。组织成员的消费由组织管理员余额承担，成员配额用于限制成员可消费的金额。',
      '分配成员配额不代表转账。余额与配额分别查看，充值到账以订单和余额的实际结果为准。',
    ],
  },
  {
    id: 'usage',
    category: '账户与用量',
    title: '查看用量与费用',
    paragraphs: [
      '用量统计按选择的起止日期查询，可以查看请求量、Token、消费和模型分布。逐条调用记录在用量明细中查看。',
      '模型目录以美元展示每百万 Token 的输入、缓存写入、缓存读取和输出价格。不同公开分组或计费条件存在差异时显示价格范围，缺失价格显示横线。',
    ],
  },
  {
    id: 'service-status',
    category: '账户与用量',
    title: '查看服务状态',
    paragraphs: [
      '服务状态展示后台探测得到的近七天可用率、最近响应耗时和近期可用性记录。',
      '历史状态条对应实际探测记录，覆盖时间取决于探测间隔和返回记录数量。暂无记录表示缺少探测结果，不能据此判断服务正常或故障。',
    ],
  },
];
