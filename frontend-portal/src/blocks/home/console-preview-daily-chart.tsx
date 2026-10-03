import { useTranslations } from 'next-intl';

import { PREVIEW_DAILY_REQUESTS } from '@/lib/content/console-preview';

/**
 * 近 14 天调用量折线图（纯展示的手写 SVG）。
 * x 轴 14 个点均分，y 按 100～250（千次）线性映射到 120～10 的绘图区。
 */
export function ConsolePreviewDailyChart() {
  const t = useTranslations('homeHero.preview.charts.daily');

  const W = 320;
  const TOP = 10;
  const BOTTOM = 120;
  const VALUE_MIN = 100;
  const VALUE_MAX = 250;
  const count = PREVIEW_DAILY_REQUESTS.length;

  const points = PREVIEW_DAILY_REQUESTS.map((value, i) => {
    const x = count > 1 ? (i / (count - 1)) * W : 0;
    const y = BOTTOM - ((value - VALUE_MIN) / (VALUE_MAX - VALUE_MIN)) * (BOTTOM - TOP);
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const area = `${line} L${W} ${BOTTOM + 10} L0 ${BOTTOM + 10} Z`;
  const last = points[count - 1];

  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label={`${t('title')} · ${t('unit')}`}
      className="mt-4 block w-full"
    >
      <defs>
        {/* 面积渐隐：颜色走图表令牌变量，亮暗主题自动跟随 */}
        <linearGradient id="preview-daily-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 横向 4 条网格线，均分绘图区 10～120 */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          x2={W}
          y1={TOP + (i * (BOTTOM - TOP)) / 3}
          y2={TOP + (i * (BOTTOM - TOP)) / 3}
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill="url(#preview-daily-area)" />
      <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} />
      {last ? <circle cx={last.x} cy={last.y} r={3.5} fill="var(--chart-1)" /> : null}
      {/* 三个刻度：起点居左、中点居中、终点居右 */}
      <text x="0" y="138" fill="var(--subtle-foreground)" fontSize="10">
        {t('start')}
      </text>
      <text x={W / 2} y="138" fill="var(--subtle-foreground)" fontSize="10" textAnchor="middle">
        {t('mid')}
      </text>
      <text x={W} y="138" fill="var(--subtle-foreground)" fontSize="10" textAnchor="end">
        {t('end')}
      </text>
    </svg>
  );
}
