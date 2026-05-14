'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';

const DEFAULT_EASE = [0.22, 1, 0.36, 1] as const;

type AnimatedNumberProps = {
  value: number;
  formatter?: (value: number) => string;
  from?: number;
  duration?: number;
  className?: string;
  replayKey?: string | number;
};

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function defaultFormatter(value: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(value));
}

export function AnimatedNumber({
  value,
  formatter = defaultFormatter,
  from = 0,
  duration = 1,
  className,
  replayKey,
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const safeTarget = normalizeNumber(value);
  const safeFrom = normalizeNumber(from);
  const motionValue = useMotionValue(safeFrom);
  const latestTargetRef = useRef(safeFrom);
  const replayKeyRef = useRef(replayKey);

  const displayValue = useTransform(motionValue, (latest) => formatter(latest));

  useEffect(() => {
    const shouldReplay = replayKeyRef.current !== replayKey;
    const startValue = shouldReplay ? safeFrom : latestTargetRef.current;

    motionValue.set(shouldReduceMotion ? safeTarget : startValue);
    latestTargetRef.current = safeTarget;
    replayKeyRef.current = replayKey;

    if (shouldReduceMotion) return undefined;

    const controls = animate(motionValue, safeTarget, {
      duration,
      ease: DEFAULT_EASE,
    });

    return () => controls.stop();
  }, [duration, motionValue, replayKey, safeFrom, safeTarget, shouldReduceMotion]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}
