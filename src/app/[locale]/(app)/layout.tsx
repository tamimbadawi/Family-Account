'use client';

import * as React from 'react';
import { RepositoryProvider } from '@/lib/data/provider';
import { Header } from '@/components/layout/Header';
import { TabBar } from '@/components/layout/TabBar';
import { PageTransition } from '@/components/layout/PageTransition';
import { EntrySheetProvider } from '@/components/entry/EntrySheetContext';
import { EntrySheet } from '@/components/entry/EntrySheet';
import { TourProvider } from '@/components/tour/TourProvider';
import { Toaster } from '@/components/ui/sonner';
import { UpdatingPill } from '@/components/layout/UpdatingPill';
// Keeps Android's install popup from the moment the app loads, for Settings → Install app
import '@/lib/standalone';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RepositoryProvider>
      <EntrySheetProvider>
        <TourProvider>
        <div className="mx-auto flex h-dvh max-w-[520px] flex-col overflow-hidden bg-canvas text-ink relative shadow-2xl">
          <Toaster position="bottom-center" />
          <UpdatingPill />
          <Header />
          
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
            <PageTransition>
              {children}
            </PageTransition>
          </main>

          <TabBar />
          <EntrySheet />
        </div>
        </TourProvider>
      </EntrySheetProvider>
    </RepositoryProvider>
  );
}
