import * as React from 'react';
import { Toaster } from '@/components/ui/sonner';

/**
 * The operator's own space: no family header, no tab bar, no + button. Wider than the family screens
 * so it also reads well on a computer; on the phone it is the same full-screen shell.
 */
export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh max-w-[720px] flex-col overflow-hidden bg-canvas text-ink">
      <Toaster position="bottom-center" />
      {children}
    </div>
  );
}
