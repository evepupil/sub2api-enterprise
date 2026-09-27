const money = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});
export function formatOrganizationMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? money.format(value) : '—';
}
export function formatOrganizationDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '—';
}
export function organizationMemberLabel(value: {
  displayName: string;
  username: string;
  email: string;
  userId: number;
}): string {
  return (
    value.displayName.trim() ||
    value.username.trim() ||
    value.email.trim() ||
    `成员 #${value.userId}`
  );
}
