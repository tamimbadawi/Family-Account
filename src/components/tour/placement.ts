export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface BubblePlacement {
  top: number;
  left: number;
  side: 'above' | 'below' | 'center';
  /** Where the little pointer sits, measured from the bubble's left edge. */
  arrowLeft: number;
}

/** Space kept between the bubble and the screen edges (the 16px gutter). */
export const EDGE = 16;
/** Gap between the highlighted part and the bubble, room for the pointer. */
export const GAP = 14;
/** Extra room drawn around the highlighted part. */
export const PAD = 6;

/**
 * Puts the bubble below the highlighted part when it fits, otherwise above it, otherwise in
 * the middle of the screen; always fully on screen.
 */
export function placeBubble(
  target: Box | null,
  bubble: { width: number; height: number },
  viewport: { width: number; height: number },
): BubblePlacement {
  const width = Math.min(bubble.width, viewport.width - EDGE * 2);
  const centered: BubblePlacement = {
    top: Math.max(EDGE, (viewport.height - bubble.height) / 2),
    left: (viewport.width - width) / 2,
    side: 'center',
    arrowLeft: width / 2,
  };
  if (!target) return centered;

  const spotTop = target.top - PAD;
  const spotBottom = target.top + target.height + PAD;
  const roomBelow = viewport.height - spotBottom - GAP - EDGE;
  const roomAbove = spotTop - GAP - EDGE;

  let side: BubblePlacement['side'];
  if (bubble.height <= roomBelow) side = 'below';
  else if (bubble.height <= roomAbove) side = 'above';
  else return centered;

  const targetMid = target.left + target.width / 2;
  const left = clamp(targetMid - width / 2, EDGE, viewport.width - EDGE - width);
  const top = side === 'below' ? spotBottom + GAP : spotTop - GAP - bubble.height;
  // Keep the pointer off the rounded corners
  const arrowLeft = clamp(targetMid - left, 24, width - 24);

  return { top, left, side, arrowLeft };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
