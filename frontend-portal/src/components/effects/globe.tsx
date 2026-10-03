'use client';

import createGlobe, { type COBEOptions } from 'cobe';
import { useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/** 服务节点所在城市，格式是 [纬度, 经度] */
const CITIES: readonly [number, number][] = [
  [39.9, 116.41], // 北京
  [31.23, 121.47], // 上海
  [22.32, 114.17], // 香港
  [1.35, 103.82], // 新加坡
  [35.68, 139.65], // 东京
  [37.77, -122.42], // 旧金山
  [50.11, 8.68], // 法兰克福
  [51.51, -0.13], // 伦敦
];

const GLOBE_OPTIONS: COBEOptions = {
  devicePixelRatio: 2,
  width: 1200,
  height: 1200,
  phi: 0,
  theta: 0.25,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 6,
  baseColor: [0.3, 0.3, 0.3],
  markerColor: [0.15, 0.55, 1],
  glowColor: [1, 1, 1],
  markers: CITIES.map((location) => ({ location, size: 0.06 })),
};

/** 每帧自转的弧度 */
const ROTATE_STEP = 0.004;

/** 这块 canvas 上是否已经有 WebGL 绘图上下文（cobe 画成功时一定有） */
function hasWebGLContext(canvas: HTMLCanvasElement): boolean {
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
}

/**
 * 自转的地球，用 cobe 画在 canvas 上。
 * cobe 2.0 只在创建和调用 update 时各画一帧，不带自己的渲染循环，所以自转由这里的 requestAnimationFrame 驱动。
 * 减少动态效果时只画静止的一帧；滚出屏幕时暂停自转；没有 WebGL 时退回一个静态球体。
 */
export function Globe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);

  // 用 useLayoutEffect：卸载时 React 先删 canvas 再跑普通 effect 的清理，那时 canvas 已被 cobe 套进别的 div，会删不掉
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const home = canvas.parentNode;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let observer: IntersectionObserver | null = null;
    let frame = 0;

    // cobe 会在 canvas 外面再套一层 div。收尾时把 canvas 放回原位，React 才能正常卸载它
    const unwrap = () => {
      const wrapper = canvas.parentNode;
      if (home && wrapper && wrapper !== home) {
        home.insertBefore(canvas, wrapper);
        wrapper.parentNode?.removeChild(wrapper);
      }
    };

    const start = () => {
      try {
        globe = createGlobe(canvas, { ...GLOBE_OPTIONS });
      } catch {
        globe = null;
      }
      // cobe 2.0 拿不到 WebGL 时不会抛错，只悄悄返回一个什么都不做的对象，
      // 所以除了捕获异常，还要确认这块 canvas 上真的有绘图上下文，否则改画静态球体
      if (!globe || !hasWebGLContext(canvas)) {
        globe?.destroy();
        globe = null;
        unwrap();
        setFailed(true);
        return;
      }

      // 创建时第一帧已经画好，淡入显示
      canvas.style.opacity = '1';
      if (reduceMotion) return;

      let phi = 0;
      let visible = true;
      observer = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true;
      });
      observer.observe(canvas);

      const tick = () => {
        if (visible) {
          phi += ROTATE_STEP;
          globe?.update({ phi });
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(start);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      globe?.destroy();
      unwrap();
    };
  }, [reduceMotion]);

  if (failed) {
    return (
      <div
        aria-hidden
        className={cn(
          'aspect-square size-full rounded-full bg-[radial-gradient(circle_at_30%_30%,#3f3f46,#09090b_70%)]',
          className,
        )}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        'aspect-square size-full opacity-0 transition-opacity duration-700 [contain:layout_paint_size]',
        className,
      )}
    />
  );
}
