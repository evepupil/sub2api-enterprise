'use client';

export interface ChartTheme {
  colors: string[];
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  /** 提示框等浮层背景：控制台表面色，读不到时依次回退卡片色、气泡层色。 */
  surface: string;
  /** 提示框浮起阴影，经 tooltip.extraCssText 注入，浅色两层柔和阴影、深色单层。 */
  raisedShadow: string;
  /** 网格线颜色：描边色 50% 透明。 */
  gridLine: string;
}

/**
 * 把颜色转成带透明度的版本：`--border` 等描边令牌固定是 6 位十六进制，直接
 * 算出精确 rgba；遇到解析不了的格式（理论上不会出现）用 CSS color-mix 兜
 * 底，同样只消费令牌本身的颜色，不写入新的调色板色值。
 */
function withAlpha(color: string, alpha: number): string {
  if (color === '') return color;
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex !== null) {
    const [, r, g, b] = hex;
    return `rgba(${parseInt(r ?? '00', 16)}, ${parseInt(g ?? '00', 16)}, ${parseInt(b ?? '00', 16)}, ${alpha})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

export function readChartTheme(element: HTMLElement): ChartTheme {
  const computed = getComputedStyle(element);
  const read = (name: string): string => computed.getPropertyValue(name).trim();
  const border = read('--border');
  return {
    colors: Array.from({ length: 6 }, (_, index) => read(`--chart-${index + 1}`)).filter(
      (color) => color !== '',
    ),
    foreground: read('--foreground'),
    mutedForeground: read('--muted-foreground'),
    card: read('--card'),
    border,
    surface: read('--console-surface') || read('--card') || read('--popover'),
    raisedShadow: read('--console-shadow-raised') || read('--overlay-shadow'),
    gridLine: withAlpha(border, 0.5),
  };
}
