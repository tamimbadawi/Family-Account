// "Someone is in the middle of something": while an entry is open (typing an amount, taking a receipt
// photo in the camera app), the app must not reload itself for an update and lose that work.

let openCount = 0;
const idleListeners = new Set<() => void>();

export function markBusy(): () => void {
  openCount += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    openCount -= 1;
    if (openCount === 0) idleListeners.forEach((run) => run());
  };
}

export function isBusy(): boolean {
  return openCount > 0;
}

/** Runs `run` now if nothing is open, otherwise as soon as the last open thing closes. */
export function whenIdle(run: () => void): void {
  if (openCount === 0) {
    run();
    return;
  }
  const once = () => {
    idleListeners.delete(once);
    run();
  };
  idleListeners.add(once);
}
