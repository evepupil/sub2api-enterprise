import { cn } from '@/lib/utils';

/**
 * 品牌图形「C 抱 o」：粗圆环开口成 C，中间实心圆点是 o。颜色跟随文字颜色，明暗主题自动适配。
 * 几何（32 网格）：圆环中心线半径 10.5、线宽 5.5、开口朝右上下各 40°、圆头；圆点半径 3.6。
 * 浏览器标签图标 src/app/icon.svg 用同一组路径，改这里要一起改（规格见 docs/前端设计.md「品牌标志」）。
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden fill="none" className={cn('shrink-0', className)}>
      <path
        d="M24.04 9.25A10.5 10.5 0 1 0 24.04 22.75"
        stroke="currentColor"
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      <circle cx={16} cy={16} r={3.6} fill="currentColor" />
    </svg>
  );
}
