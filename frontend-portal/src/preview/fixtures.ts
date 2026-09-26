/** 仅供 M0 内部预览使用的构造数据，不参与业务请求。 */
export interface PreviewKey {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  spent: string;
  expiresAt: string;
}

export const initialKeys: readonly PreviewKey[] = [
  { id: 'preview-1', name: '工作项目', status: 'active', spent: '$24.80', expiresAt: '2026-12-31' },
  { id: 'preview-2', name: '个人工具', status: 'active', spent: '$3.16', expiresAt: '2026-11-30' },
  {
    id: 'preview-3',
    name: '用于验证长名称换行与表格容器自适应的项目密钥',
    status: 'disabled',
    spent: '$0.00',
    expiresAt: '2026-10-31',
  },
];

export const previewMetrics = [
  { label: '请求', value: '2,000' },
  { label: 'Token', value: '12.86M' },
  { label: '消费', value: '$84.5605' },
  { label: '平均耗时', value: '12.80s' },
] as const;

export const previewDateRange = {
  from: new Date(2026, 8, 20),
  to: new Date(2026, 8, 26),
};
