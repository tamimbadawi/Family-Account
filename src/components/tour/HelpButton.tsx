'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, CircleHelp, History, PieChart, PiggyBank, Plus, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { usePathname } from '@/i18n/navigation';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useTour } from './TourProvider';
import { GUIDE_ORDER, guideForPath, type TourId } from './tours';

const GUIDE_ICONS: Record<TourId, LucideIcon> = {
  welcome: Sparkles,
  addEntry: Plus,
  money: PiggyBank,
  history: History,
  reports: PieChart,
  settings: Settings,
};

/** Wait for the Help sheet to slide away before the guide dims the screen. */
const SHEET_CLOSE_MS = 300;

/**
 * The "?" in the top corner of every main screen. Opens a short list of guides; the one for
 * the screen the person is on comes first.
 */
export function HelpButton() {
  const t = useTranslations('tour');
  const pathname = usePathname();
  const { start } = useTour();
  const [open, setOpen] = React.useState(false);

  const here = guideForPath(pathname);
  const guides = [here, ...GUIDE_ORDER.filter((id) => id !== here)];

  const pick = (id: TourId) => {
    setOpen(false);
    window.setTimeout(() => start(id), SHEET_CLOSE_MS);
  };

  return (
    <>
      <button
        type="button"
        data-tour="help-button"
        onClick={() => setOpen(true)}
        aria-label={t('helpButton')}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-xs active:scale-95 transition-transform cursor-pointer"
      >
        <CircleHelp className="size-6" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className="px-5 pb-2 text-start">
            <DrawerTitle className="text-title font-bold text-ink">{t('helpTitle')}</DrawerTitle>
            <DrawerDescription className="text-body text-ink-muted">{t('helpIntro')}</DrawerDescription>
          </DrawerHeader>

          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="divide-y divide-line/30 rounded-card border border-line/40 bg-surface shadow-card">
              {guides.map((id) => {
                const Icon = GUIDE_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pick(id)}
                    className="flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors active:bg-surface-2 cursor-pointer"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold text-ink leading-tight">{t(`guides.${id}.title`)}</div>
                      <div className="text-caption text-ink-muted leading-tight">{t(`guides.${id}.hint`)}</div>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-ink-muted rtl:rotate-180" />
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
