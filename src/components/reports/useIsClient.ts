'use client';

import * as React from 'react';

const emptySubscribe = () => () => {};

/**
 * Safe hook to detect client-side mounting without triggering cascading render lint errors.
 */
export function useIsClient(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
