'use client';

import * as React from 'react';

/** Counts a number up over 600 ms, Family Account style; jumps straight there under reduced motion. */
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = React.useState(target);
  const from = React.useRef(target);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const a = from.current;
    let raf = 0;

    const tick = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(a + (target - a) * eased);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        from.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
