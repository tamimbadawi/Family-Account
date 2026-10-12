'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { placeBubble, PAD, type Box } from './placement';
import type { TourId, TourStep } from './tours';

/** How long to look for a part before skipping it (screens and sheets take a moment to appear). */
const FIND_TIMEOUT_MS = 1500;

interface Spot extends Box {
  radius: number;
}

function sameSpot(a: Spot | null, b: Spot | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function findTarget(target: string): HTMLElement | null {
  // The first one that is actually on screen (hidden copies have no size)
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Follows the highlighted part every frame, so the spotlight stays on it while a sheet slides
 * up or a list scrolls. Reports `missing` when the part never shows up.
 */
function useSpot(target: string | undefined, waiting: boolean, onMissing: () => void) {
  const [spot, setSpot] = React.useState<Spot | null>(null);
  const missingRef = React.useRef(onMissing);
  React.useEffect(() => {
    missingRef.current = onMissing;
  });

  React.useEffect(() => {
    if (!target || waiting) return;
    let frame = 0;
    let scrolled = false;
    let last: Spot | null = null;
    const startedAt = performance.now();

    const tick = () => {
      const el = findTarget(target);
      if (!el) {
        if (performance.now() - startedAt > FIND_TIMEOUT_MS) {
          missingRef.current();
          return;
        }
      } else {
        const r = el.getBoundingClientRect();
        if (!scrolled) {
          scrolled = true;
          if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest' });
        }
        const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
        const next: Spot = {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          radius: Math.min(radius, Math.min(r.width, r.height) / 2) + PAD,
        };
        if (!sameSpot(last, next)) {
          last = next;
          setSpot(next);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setSpot(null);
    };
  }, [target, waiting]);

  return target ? spot : null;
}

function useViewport() {
  const [size, setSize] = React.useState({ width: 390, height: 844 });
  React.useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

export interface TourOverlayProps {
  tourId: TourId;
  step: TourStep;
  index: number;
  count: number;
  waiting: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onMissing: () => void;
}

/**
 * Dims the screen except for one part, with a gently pulsing ring around it and a bubble that
 * says what it is for. Back / Next move through the steps; ✕ ends the guide at any time.
 */
export function TourOverlay({ tourId, step, index, count, waiting, onNext, onBack, onClose, onMissing }: TourOverlayProps) {
  const t = useTranslations('tour');
  const reduceMotion = useReducedMotion();
  const viewport = useViewport();
  const spot = useSpot(step.target, waiting, onMissing);

  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);
  const [bubbleSize, setBubbleSize] = React.useState({ width: 358, height: 220 });

  React.useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const measure = () => {
      const { offsetWidth: width, offsetHeight: height } = el;
      setBubbleSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Escape ends the guide; the Next button takes focus on each step
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  React.useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  const showBubble = !waiting && (!step.target || spot !== null);
  const place = placeBubble(spot, bubbleSize, viewport);
  const isLast = index === count - 1;
  const move = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const };

  return createPortal(
    <div
      data-tour-overlay=""
      // An open sheet turns taps off for the rest of the page; the guide must still answer
      style={{ pointerEvents: 'auto' }}
      className="fixed inset-0 z-[100] select-none"
    >
      {/* Dim everything except the highlighted part */}
      <svg className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <mask id="tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <motion.rect
                initial={false}
                animate={{
                  x: spot.left - PAD,
                  y: spot.top - PAD,
                  width: spot.width + PAD * 2,
                  height: spot.height + PAD * 2,
                  rx: spot.radius,
                }}
                transition={move}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <motion.rect
          width="100%"
          height="100%"
          className="fill-black/55"
          mask="url(#tour-spotlight)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={move}
        />
      </svg>

      {/* The ring that points at the part */}
      {spot && (
        <motion.div
          aria-hidden
          initial={false}
          animate={{
            top: spot.top - PAD,
            left: spot.left - PAD,
            width: spot.width + PAD * 2,
            height: spot.height + PAD * 2,
            borderRadius: spot.radius,
          }}
          transition={move}
          className="pointer-events-none absolute ring-3 ring-accent"
        >
          {!reduceMotion && (
            <motion.div
              className="absolute -inset-1.5 rounded-[inherit] ring-4 ring-accent/50"
              animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.06, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </motion.div>
      )}

      {/* The bubble */}
      <motion.div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        initial={false}
        animate={{ top: place.top, left: place.left, opacity: showBubble ? 1 : 0 }}
        transition={move}
        style={{ width: `min(22.375rem, calc(100vw - 2rem))` }}
        className={`absolute rounded-card bg-surface p-4 pt-2 text-ink shadow-sheet ${showBubble ? '' : 'pointer-events-none'}`}
      >
        {/* Pointer towards the part */}
        {place.side !== 'center' && (
          <span
            aria-hidden
            style={{ left: place.arrowLeft }}
            className={`absolute size-4 -translate-x-1/2 rotate-45 bg-surface ${
              place.side === 'below' ? '-top-2' : '-bottom-2'
            }`}
          />
        )}

        <div className="flex items-center justify-between gap-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5" aria-label={t('progress', { step: index + 1, count })}>
            {Array.from({ length: count }, (_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === index ? 'w-5 bg-accent' : 'w-2 bg-line'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-me-2 flex size-12 shrink-0 items-center justify-center rounded-full text-ink-muted active:scale-95 transition-transform cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <motion.div
          key={step.id}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={move}
          aria-live="polite"
        >
          <h2 id="tour-title" className="text-heading font-bold text-ink">
            {t(`${tourId}.${step.id}.title`)}
          </h2>
          <p id="tour-body" className="mt-1 text-body text-ink-muted leading-snug">
            {t(`${tourId}.${step.id}.body`)}
          </p>
        </motion.div>

        <div className="mt-4 flex gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="h-12 shrink-0 rounded-2xl bg-surface-2 px-5 text-body font-semibold text-ink active:scale-[0.98] transition-transform cursor-pointer"
            >
              {t('back')}
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className="h-12 flex-1 rounded-2xl bg-accent px-5 text-body font-semibold text-accent-ink outline-none active:scale-[0.98] transition-transform cursor-pointer"
          >
            {isLast ? t('done') : tourId === 'welcome' && index === 0 ? t('start') : t('next')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
