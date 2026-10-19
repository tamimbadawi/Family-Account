'use client';

import * as React from 'react';
import { initViewportHeight } from '@/lib/viewport-height';

export function ViewportHeight() {
  React.useEffect(() => {
    return initViewportHeight();
  }, []);

  return null;
}
