'use client';

import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';

type ContainerScrollProps = { titleComponent: ReactNode; children: ReactNode };

const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getMobileSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

function getMobileServerSnapshot() {
  return false;
}

function subscribeToMobileQuery(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

/** Adapted from Aceternity Container Scroll Animation for the dashboard preview. */
export function ContainerScroll({ titleComponent, children }: ContainerScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 85%', 'start 12%'],
  });
  const isMobile = useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );
  // Use the same first snapshot on server and client; media preference applies after hydration.
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getMobileServerSnapshot,
  );
  const rotate = useTransform(scrollYProgress, [0, 1], [isMobile ? 8 : 20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], isMobile ? [0.96, 1] : [1.035, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -12]);

  return (
    <div className="scroll-container" ref={containerRef}>
      <div className="scroll-perspective">
        <PreviewCaption translate={translate} reducedMotion={Boolean(reducedMotion)}>
          {titleComponent}
        </PreviewCaption>
        <PreviewCard rotate={rotate} scale={scale} reducedMotion={Boolean(reducedMotion)}>
          {children}
        </PreviewCard>
      </div>
    </div>
  );
}

function PreviewCaption({
  translate,
  reducedMotion,
  children,
}: {
  translate: MotionValue<number>;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div className="preview-caption" style={{ translateY: reducedMotion ? 0 : translate }}>
      {children}
    </motion.div>
  );
}

function PreviewCard({
  rotate,
  scale,
  reducedMotion,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="scroll-card"
      style={{ rotateX: reducedMotion ? 0 : rotate, scale: reducedMotion ? 1 : scale }}
    >
      <div className="preview-content">{children}</div>
    </motion.div>
  );
}
