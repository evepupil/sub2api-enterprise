/**
 * 图表分类配色。
 *
 * 饼图、堆叠柱、多线趋势都从这里按顺序取色，保证同一份数据
 * 在不同图里的颜色一致。顺序不要随便调，调了旧截图就对不上了。
 * 这是分类色，不是品牌色，所以不跟着主色走。
 */
export const CHART_COLORS: string[] = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7'
]

/** 按序号取色，超出长度自动循环。 */
export function chartColorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}
