import { useId, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/** 网格单元宽高：竖线每 240px 一条，横线每 164px 一条 */
const CELL_WIDTH = 240;
const CELL_HEIGHT = 164;

type CssVars = CSSProperties & { [name: `--${string}`]: string };

interface Beam {
  /** 贴着第几条网格线：竖向光线是 x 坐标，横向光线是 y 坐标 */
  at: number;
  /** 流过整条线的秒数 */
  duration: number;
  /** 负数表示动画一开始就已经跑了这么多秒，让几条光线错开 */
  delay: number;
}

/** 三条竖向光线，贴在 x = 240、720、1200 的竖线上 */
const VERTICAL_BEAMS: readonly Beam[] = [
  { at: 240, duration: 9, delay: -1 },
  { at: 720, duration: 11, delay: -6 },
  { at: 1200, duration: 8, delay: -3 },
];

/** 三条横向光线，贴在 y = 164、328、492 的横线上 */
const HORIZONTAL_BEAMS: readonly Beam[] = [
  { at: 164, duration: 12, delay: -4 },
  { at: 328, duration: 10, delay: -8 },
  { at: 492, duration: 13, delay: -2 },
];

function beamStyle(beam: Beam, travel: number): CssVars {
  return {
    '--beam-duration': `${beam.duration}s`,
    '--beam-delay': `${beam.delay}s`,
    '--beam-travel': `${travel}px`,
  };
}

/**
 * 背景网格：细线加交点圆点，上面有几条光线沿网格线流动。
 * 铺满最近的定位父级，边缘用椭圆遮罩渐隐；父级要自己写 relative 和 overflow-hidden。
 */
export function GridBeams({ className, beams = true }: { className?: string; beams?: boolean }) {
  // useId 的结果带冒号等符号，不能直接用在 url(#...) 里
  const patternId = `grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]',
        className,
      )}
    >
      <svg className="absolute inset-0 size-full">
        <defs>
          <pattern
            id={patternId}
            width={CELL_WIDTH}
            height={CELL_HEIGHT}
            patternUnits="userSpaceOnUse"
          >
            {/* 右边线和下边线各占单元最外侧的 1px，相邻单元拼起来就是完整的网格 */}
            <path
              d={`M${CELL_WIDTH - 0.5} 0V${CELL_HEIGHT}M0 ${CELL_HEIGHT - 0.5}H${CELL_WIDTH}`}
              fill="none"
              stroke="var(--grid-line)"
              strokeWidth="1"
            />
            {/* 圆点画在单元四个角：每个单元只显示落在自己范围内的四分之一，四个单元拼出一个完整的圆 */}
            <circle cx={CELL_WIDTH} cy={CELL_HEIGHT} r="3" fill="var(--grid-dot)" />
            <circle cx="0" cy={CELL_HEIGHT} r="3" fill="var(--grid-dot)" />
            <circle cx={CELL_WIDTH} cy="0" r="3" fill="var(--grid-dot)" />
            <circle cx="0" cy="0" r="3" fill="var(--grid-dot)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      {beams ? (
        <>
          {VERTICAL_BEAMS.map((beam) => (
            <span
              key={`v-${beam.at}`}
              data-beam
              className="absolute top-0 h-28 w-px bg-gradient-to-b from-transparent via-beam to-transparent animate-beam-y"
              style={{ left: beam.at - 1, ...beamStyle(beam, 900) }}
            />
          ))}
          {HORIZONTAL_BEAMS.map((beam) => (
            <span
              key={`h-${beam.at}`}
              data-beam
              className="absolute left-0 h-px w-28 bg-gradient-to-r from-transparent via-beam to-transparent animate-beam-x"
              style={{ top: beam.at - 1, ...beamStyle(beam, 1440) }}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
