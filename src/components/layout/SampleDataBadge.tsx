'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { useHasSampleData, useRepository } from '@/lib/data/provider';
import { useFamily, useIsFamilyAdmin } from '@/lib/auth/use-family-members';
import { isAuthConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// Header chip shown while the phone still holds the sample entries, so new families know the
// numbers are made up. Tapping it explains; the family admin can clear the samples from there.
export function SampleDataBadge({ className = '' }: { className?: string }) {
  const t = useTranslations('sample');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const repo = useRepository();
  const hasSample = useHasSampleData();
  const isAdmin = useIsFamilyAdmin();
  const adminName = useFamily().find((m) => m.role === 'owner')?.displayName;
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!hasSample || typeof repo.clearSampleData !== 'function') return null;

  const handleClear = async () => {
    if (!repo.clearSampleData) return;
    setBusy(true);
    try {
      const undo = await repo.clearSampleData();
      setOpen(false);
      router.replace('/');
      toast.success(t('cleared'), {
        duration: 6000,
        action: { label: tCommon('undo'), onClick: () => void undo() },
      });
    } catch (err) {
      console.error(err);
      toast.error(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('badgeLabel')}
        className={`flex min-h-12 shrink-0 items-center select-none active:scale-95 transition-transform ${className}`}
      >
        <span className="flex items-center gap-1 rounded-full bg-member-2-soft px-2.5 py-1 text-caption font-semibold text-member-2">
          <FlaskConical className="size-4" aria-hidden="true" />
          {t('badge')}
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90dvh] px-5 pb-8 select-none">
          <DrawerHeader className="px-0 pt-3 pb-2 text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-member-2-soft text-member-2">
              <FlaskConical className="size-7" aria-hidden="true" />
            </div>
            <DrawerTitle className="text-title font-bold text-ink text-center">{t('title')}</DrawerTitle>
            <DrawerDescription className="text-body text-ink-muted text-center">{t('body')}</DrawerDescription>
          </DrawerHeader>

          <p className="text-body text-ink-muted text-center pb-5">
            {isAdmin === false
              ? isAuthConfigured() && adminName
                ? t('memberBody', { name: adminName })
                : t('memberBodyPlain')
              : t('adminBody')}
          </p>

          <div className="space-y-2">
            {isAdmin && (
              <Button variant="destructive" className="w-full" disabled={busy} onClick={handleClear}>
                {t('clear')}
              </Button>
            )}
            <Button variant={isAdmin ? 'ghost' : 'default'} className="w-full" onClick={() => setOpen(false)}>
              {t('keep')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
