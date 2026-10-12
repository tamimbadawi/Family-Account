'use client';

import * as React from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { TourOverlay } from './TourOverlay';
import { isTourId, TOURS, type TourId } from './tours';

/** Set once the welcome tour has been offered, so it only starts by itself the very first time. */
const SEEN_KEY = 'fa_tour_seen';

interface TourContextValue {
  start: (id: TourId) => void;
  stop: () => void;
  activeTour: TourId | null;
}

const TourContext = React.createContext<TourContextValue | null>(null);

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Private mode or blocked storage: never start by itself rather than every time
    return true;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to remember it in; the guide is still in Help
  }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen: isSheetOpen, openAdd, close: closeSheet } = useEntrySheet();

  const [tour, setTour] = React.useState<{ id: TourId; index: number; forward: boolean } | null>(null);
  // Only a sheet the tour opened is closed by the tour
  const openedSheetRef = React.useRef(false);

  const steps = tour ? TOURS[tour.id] : null;
  const step = tour && steps ? steps[tour.index] : null;

  const start = React.useCallback((id: TourId) => {
    markSeen();
    setTour({ id, index: 0, forward: true });
  }, []);

  const stop = React.useCallback(() => setTour(null), []);

  const next = React.useCallback(() => {
    setTour((t) => {
      if (!t) return t;
      return t.index + 1 < TOURS[t.id].length ? { ...t, index: t.index + 1, forward: true } : null;
    });
  }, []);

  const back = React.useCallback(() => {
    setTour((t) => (t && t.index > 0 ? { ...t, index: t.index - 1, forward: false } : t));
  }, []);

  // A part that is not on screen right now (e.g. Home before the first entry) is skipped
  const skipMissing = React.useCallback(() => {
    setTour((t) => {
      if (!t) return t;
      const to = t.forward ? t.index + 1 : t.index - 1;
      if (to < 0) return { ...t, index: 0, forward: true };
      return to < TOURS[t.id].length ? { ...t, index: to } : null;
    });
  }, []);

  // Go to the screen the step is on
  React.useEffect(() => {
    if (step?.route && pathname !== step.route) router.push(step.route);
  }, [step, pathname, router]);

  // Open the Add sheet for the steps inside it, close it again after
  React.useEffect(() => {
    if (step?.sheet) {
      if (!isSheetOpen) {
        openedSheetRef.current = true;
        openAdd();
      }
    } else if (openedSheetRef.current && isSheetOpen) {
      openedSheetRef.current = false;
      closeSheet();
    }
  }, [step, isSheetOpen, openAdd, closeSheet]);

  // First visit: show the welcome tour once Home has had a moment to appear.
  // `?tour=<id>` starts any guide (for screenshots and for sending someone straight to one).
  React.useEffect(() => {
    let requested: string | null = null;
    try {
      requested = new URLSearchParams(window.location.search).get('tour');
    } catch {
      requested = null;
    }
    if (isTourId(requested)) {
      const id = requested;
      const timer = window.setTimeout(() => start(id), 600);
      return () => window.clearTimeout(timer);
    }
    if (pathname !== '/' || readSeen()) return;
    const timer = window.setTimeout(() => start('welcome'), 900);
    return () => window.clearTimeout(timer);
    // Only on the first screen the app opens on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = React.useMemo(() => ({ start, stop, activeTour: tour?.id ?? null }), [start, stop, tour?.id]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && steps && step && (
        <TourOverlay
          key={tour.id}
          tourId={tour.id}
          step={step}
          index={tour.index}
          count={steps.length}
          // Wait for the screen to change before looking for the part
          waiting={Boolean(step.route && pathname !== step.route)}
          onNext={next}
          onBack={back}
          onClose={stop}
          onMissing={skipMissing}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = React.useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}
