'use client';

import * as React from 'react';

/**
 * Same fix the entry sheet uses: the drawer library pins a pixel height on the sheet while the
 * iPhone keyboard is open (so the field stays above the keyboard), but it does not always undo it
 * when the keyboard closes. Once the keyboard is gone, hand the height back to the layout.
 */
export function useRestoreSheetAfterKeyboard(
  sheetRef: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
) {
  React.useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!isOpen || !viewport) return;

    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      // Run after the library's own resize handler has written its styles
      frame = requestAnimationFrame(() => {
        const sheet = sheetRef.current;
        const keyboardClosed = window.innerHeight - viewport.height < 60;
        if (sheet && keyboardClosed) {
          sheet.style.removeProperty('height');
          sheet.style.removeProperty('bottom');
        }
      });
    };

    viewport.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', onResize);
    };
  }, [sheetRef, isOpen]);
}
