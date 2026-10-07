'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useObjectUrl } from '@/components/entry/ReceiptPhoto';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { compressPhoto } from '@/lib/photos/compress';
import { MAX_SUPPORT_PHOTOS, SUPPORT_EMAIL, sendSupportMessage } from '@/lib/support/send';

export interface SupportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Thumbnail of one attached photo, with a small ✕ to take it off. */
function PhotoThumb({ photo, onRemove, label }: { photo: Blob; onRemove: () => void; label: string }) {
  const url = useObjectUrl(photo);

  return (
    <div className="relative size-18 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      {url && <img src={url} alt="" className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={label}
        className="absolute end-0 top-0 flex size-8 items-center justify-center rounded-full bg-black/55 text-white active:scale-95 cursor-pointer"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Settings → Contact support: write what happened, add up to 3 photos (screenshots or pictures),
 * then Send opens the iPhone share sheet (Mail, WhatsApp…) with the message and photos.
 */
export function SupportDrawer({ open, onOpenChange }: SupportDrawerProps) {
  const t = useTranslations('settings');

  const [message, setMessage] = React.useState('');
  const [photos, setPhotos] = React.useState<Blob[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // Start empty each time the sheet opens
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMessage('');
      setPhotos([]);
      setBusy(false);
      setSending(false);
    }
  }

  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, open);

  const handleFiles = async (files: File[]) => {
    const room = MAX_SUPPORT_PHOTOS - photos.length;
    if (room <= 0) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(files.slice(0, room).map((f) => compressPhoto(f)));
      setPhotos((prev) => [...prev, ...compressed].slice(0, MAX_SUPPORT_PHOTOS));
    } catch (err) {
      console.error(err);
      toast.error(t('supportPhotoFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canSend = !sending && !busy && (message.trim() !== '' || photos.length > 0);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    const result = await sendSupportMessage(t('supportSubject'), message.trim(), photos);
    setSending(false);
    if (result === 'shared' || result === 'mailed') {
      toast.success(t('supportSent'));
      onOpenChange(false);
    } else if (result === 'failed') {
      toast.error(t('supportFailed'));
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs>
      <DrawerContent ref={sheetRef} className="max-h-[92dvh]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          <DrawerHeader className="px-0 pt-4 pb-2">
            <DrawerTitle className="text-title font-bold text-ink text-start">{t('support')}</DrawerTitle>
            <p className="text-start text-caption text-ink-muted">{t('supportHint')}</p>
          </DrawerHeader>

          <div className="space-y-4 pt-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={4}
              aria-label={t('supportMessage')}
              placeholder={t('supportPlaceholder')}
              className="w-full resize-none rounded-2xl border border-line/50 bg-surface-2 px-4 py-3 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />

            <div className="space-y-2">
              <div className="text-caption font-semibold text-ink-muted">
                {t('supportPhotos', { count: photos.length, max: MAX_SUPPORT_PHOTOS })}
              </div>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo, i) => (
                  <PhotoThumb
                    key={i}
                    photo={photo}
                    label={t('supportRemovePhoto')}
                    onRemove={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
                {photos.length < MAX_SUPPORT_PHOTOS && (
                  <label
                    className="relative flex size-18 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2 text-accent transition-transform active:scale-95"
                    aria-busy={busy}
                  >
                    {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      aria-label={t('supportAddPhoto')}
                      disabled={busy}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = ''; // the same photo can be picked again
                        if (files.length) void handleFiles(files);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {SUPPORT_EMAIL && (
              <p className="text-caption text-ink-muted">
                {t('supportSendTo')} <span dir="ltr" className="font-semibold text-ink">{SUPPORT_EMAIL}</span>
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-13 flex-1 rounded-2xl bg-surface-2 font-semibold text-ink transition-all active:scale-95 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="h-13 flex-1 rounded-2xl bg-accent font-semibold text-accent-ink shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {t('supportSend')}
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
