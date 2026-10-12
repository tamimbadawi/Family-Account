'use client';

import * as React from 'react';

/**
 * Android back button / back swipe closes the sheet on top instead of leaving the page.
 * Every open sheet, dialog or viewer is one layer with one history entry; a single listener
 * closes only the top layer. iPhone is untouched.
 *
 * A layer that closes by itself (Save, Close, swipe down, or the app navigating away) never moves
 * the history: going back there would cancel a navigation the router has just started. Its entry
 * is left behind and stepped over the next time the user goes back.
 */
interface Layer {
  close: () => void;
  depth: number; // the __layer mark of this layer's history entry
}

const layers: Layer[] = [];
let isOnLeftover = false; // the current entry belongs to a layer that has closed by itself
let isOwnBack = false; // the next popstate comes from stepBack(), not from the user
let isInstalled = false;

const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

/** How many layer entries the current history entry sits on top of. */
const entryDepth = () => (window.history.state as { __layer?: number } | null)?.__layer ?? 0;
const topDepth = () => layers.at(-1)?.depth ?? 0;

function stepBack() {
  isOwnBack = true;
  window.history.back();
}

function onPopState() {
  const depth = entryDepth();
  const wasOwnBack = isOwnBack;
  const wasOnLeftover = isOnLeftover;
  isOwnBack = false;
  isOnLeftover = false;

  if (topDepth() > depth) {
    while (topDepth() > depth) layers.pop()?.close();
    isOnLeftover = depth > topDepth();
    return;
  }
  // Landed on the entry of a layer that is no longer open: keep going
  if (depth > topDepth()) return stepBack();
  // The back press only stepped off a leftover entry and changed nothing on screen: do the back the user meant
  if (wasOnLeftover && !wasOwnBack) stepBack();
}

function install() {
  if (isInstalled) return;
  isInstalled = true;
  window.addEventListener('popstate', onPopState);

  const pushState = window.history.pushState.bind(window.history);
  const replaceState = window.history.replaceState.bind(window.history);
  // The router moved on to a new entry: nothing is left over under the user's feet any more
  window.history.pushState = (data, unused, url) => {
    isOnLeftover = false;
    pushState(data, unused, url);
  };
  // The router rewrites the state of the current entry on every update: keep the layer mark on it
  window.history.replaceState = (data, unused, url) => {
    const depth = entryDepth();
    const isSamePage = url == null || new URL(url, window.location.href).href === window.location.href;
    const isPlainState = data !== null && typeof data === 'object' && !('__layer' in data);
    replaceState(depth > 0 && isSamePage && isPlainState ? { ...data, __layer: depth } : data, unused, url);
  };
}

export function useAndroidBackToClose(isOpen: boolean | undefined, close: () => void) {
  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  });

  React.useEffect(() => {
    if (!isOpen || !isAndroid()) return;
    install();

    // A leftover entry is reused instead of adding one more
    const isReusingEntry = entryDepth() > topDepth();
    const layer: Layer = { close: () => closeRef.current(), depth: isReusingEntry ? entryDepth() : entryDepth() + 1 };
    if (!isReusingEntry) window.history.pushState({ __layer: layer.depth }, '');
    layers.push(layer);
    isOnLeftover = false;

    return () => {
      const index = layers.indexOf(layer);
      if (index === -1) return; // closed by the back button: its entry is already gone
      layers.splice(index, 1);
      isOnLeftover = entryDepth() > topDepth();
    };
  }, [isOpen]);
}
