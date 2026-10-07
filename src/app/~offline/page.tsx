import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-canvas text-ink select-none">
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-card border border-line/60 text-center space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          <WifiOff className="size-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-title font-bold text-ink">No connection</h1>
          <p className="text-body text-ink-muted">
            You can still browse your records. New entries will save once you&apos;re back online.
          </p>
        </div>

        <div className="border-t border-line/40 pt-4 space-y-1" dir="rtl">
          <h2 className="text-title font-bold text-ink">مفيش اتصال</h2>
          <p className="text-body text-ink-muted">
            تقدر تتصفح حساباتك عادي. التسجيل هيتحفظ أول ما ترجع متصل بالإنترنت.
          </p>
        </div>
      </div>
    </div>
  );
}
