/** 表格分页：每页条数选项、按页切片、页码按钮（中间用省略号） */
export const PAGE_SIZES: readonly number[] = [10, 20, 50];
export const DEFAULT_PAGE_SIZE = 20;

export interface Page<T> {
  items: T[];
  /** 夹到有效范围内的页码（从 1 开始） */
  page: number;
  pages: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pages);
  const start = (current - 1) * size;
  return { items: items.slice(start, start + size), page: current, pages, total };
}

export type PageButton = number | 'gap';

/**
 * 页码按钮：总页数不超过 7 时全部列出；否则保留首尾和当前页前后各一页，其余用省略号。
 * 例：当前第 6 页、共 12 页 → 1 … 5 6 7 … 12
 */
export function pageButtons(page: number, pages: number): PageButton[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const buttons: PageButton[] = [1];
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  if (start > 2) buttons.push('gap');
  for (let p = start; p <= end; p++) buttons.push(p);
  if (end < pages - 1) buttons.push('gap');
  buttons.push(pages);
  return buttons;
}
