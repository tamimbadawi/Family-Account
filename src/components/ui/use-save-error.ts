'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isOfflineError } from '@/lib/data/errors';

/**
 * One short toast when a save fails: "No connection — try again" without internet (nothing was
 * saved and the screen keeps what was typed), otherwise the screen's own message.
 */
export function useSaveError() {
  const tCommon = useTranslations('common');
  return useCallback(
    (err: unknown, message?: string) => {
      console.error(err);
      toast.error(isOfflineError(err) ? tCommon('noConnection') : (message ?? tCommon('saveFailed')));
    },
    [tCommon]
  );
}
