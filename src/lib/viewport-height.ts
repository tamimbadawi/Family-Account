/**
 * Viewport height utility for standalone / installed PWAs (Chrome WebAPK on Android,
 * Add to Home Screen on iOS, foldables unfolding/folding).
 *
 * 100dvh and safe area insets can lag or report stale values on cold launch, on resume,
 * and during fold/unfold transitions. We write the exact visible height into --app-h on :root.
 *
 * When the software keyboard opens (text input or textarea focused), we keep the last
 * stable height so the app shell does not jump.
 */

let lastStableHeight: number | null = null;

export function isTextInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    const nonTextTypes = new Set([
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit',
    ]);
    return !nonTextTypes.has(type);
  }
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export interface ViewportHeightParams {
  visualViewportHeight?: number | null;
  innerHeight: number;
  isInputFocused: boolean;
  lastHeight?: number | null;
}

export function calculateViewportHeight(params: ViewportHeightParams): number {
  if (params.isInputFocused && params.lastHeight != null && params.lastHeight > 0) {
    return params.lastHeight;
  }
  return params.visualViewportHeight ?? params.innerHeight;
}

export function setLastStableHeight(h: number | null): void {
  lastStableHeight = h;
}

export function getLastStableHeight(): number | null {
  return lastStableHeight;
}

export function updateViewportHeight(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

  const isFocused = isTextInputFocused();
  const vvHeight = window.visualViewport?.height ?? null;
  const innerH = window.innerHeight;

  const h = calculateViewportHeight({
    visualViewportHeight: vvHeight,
    innerHeight: innerH,
    isInputFocused: isFocused,
    lastHeight: lastStableHeight,
  });

  if (!isFocused && h > 0) {
    lastStableHeight = h;
  }

  document.documentElement.style.setProperty('--app-h', `${h}px`);
  return h;
}

function scheduleSettleRounds() {
  if (typeof window === 'undefined') return;

  requestAnimationFrame(() => {
    updateViewportHeight();
    requestAnimationFrame(() => {
      updateViewportHeight();
    });
  });

  setTimeout(updateViewportHeight, 300);
  setTimeout(updateViewportHeight, 1000);
}

export function initViewportHeight(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // First run
  updateViewportHeight();
  scheduleSettleRounds();

  const handleResize = () => updateViewportHeight();
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      updateViewportHeight();
    }
  };
  const handleLoad = () => {
    updateViewportHeight();
    scheduleSettleRounds();
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);
  window.addEventListener('pageshow', handleResize);
  window.addEventListener('focusout', handleResize);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const screenOrientation = window.screen?.orientation;
  if (screenOrientation && typeof screenOrientation.addEventListener === 'function') {
    screenOrientation.addEventListener('change', handleResize);
  }

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', handleResize);
  }

  if (document.readyState === 'complete') {
    scheduleSettleRounds();
  } else {
    window.addEventListener('load', handleLoad);
  }

  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    window.removeEventListener('pageshow', handleResize);
    window.removeEventListener('focusout', handleResize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (screenOrientation && typeof screenOrientation.removeEventListener === 'function') {
      screenOrientation.removeEventListener('change', handleResize);
    }
    if (vv) {
      vv.removeEventListener('resize', handleResize);
    }
    window.removeEventListener('load', handleLoad);
  };
}
