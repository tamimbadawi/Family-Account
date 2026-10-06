'use client';

import * as React from 'react';

/**
 * Smoothly animates a number towards a target value.
 * Honors prefers-reduced-motion by updating immediately.
 */
export function useCountUp(target: number, durationMs: number = 500): number {
  const [current, setCurrent] = React.useState(target);
  const startRef = React.useRef(target);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      startRef.current = target;
      return;
    }

    const startVal = startRef.current;
    if (startVal === target) {
      return;
    }

    let animationFrame: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutCubic curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const nextVal = startVal + (target - startVal) * easeProgress;

      setCurrent(nextVal);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCurrent(target);
        startRef.current = target;
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [target, durationMs]);

  // If reduced motion is preferred, return target directly
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return target;
  }

  return current;
}
