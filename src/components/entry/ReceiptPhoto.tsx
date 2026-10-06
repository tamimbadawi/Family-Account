'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Camera, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { compressPhoto } from '@/lib/photos/compress';

const CHIP =
  'relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-accent transition-transform active:scale-95 cursor-pointer';

const VIEWER_BUTTON =
  'relative flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/15 text-body font-semibold text-white transition-transform active:scale-95 cursor-pointer';

// Invisible camera input stretched over its label (a real tap is needed to open the iPhone camera)
const FILE_OVERLAY = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';

/**
 * Object URL for a blob, revoked once the blob changes or the component unmounts.
 * The revoke waits a moment so StrictMode's dev-only effect re-run doesn't break a URL still in use.
 */
function useObjectUrl(blob: Blob | null): string | null {
  const url = React.useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const pendingRevokes = React.useRef(new Map<string, number>());

  React.useEffect(() => {
    if (!url) return;
    const pending = pendingRevokes.current;
    window.clearTimeout(pending.get(url));
    pending.delete(url);
    return () => {
      pending.set(
        url,
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          pending.delete(url);
        }, 1000)
      );
    };
  }, [url]);

  return url;
}

function CameraInput({ onFile, label }: { onFile: (file: File) => void; label: string }) {
  return (
    <input
      type="file"
      accept="image/*"
      capture="environment"
      aria-label={label}
      className={FILE_OVERLAY}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // the same photo can be picked again
        if (file) onFile(file);
      }}
    />
  );
}

export interface ReceiptPhotoProps {
  photo: Blob | null;
  onChange: (photo: Blob | null) => void;
}

/** 📷 square next to Save: takes a receipt photo, shows its thumbnail, opens the viewer. */
export function ReceiptPhoto({ photo, onChange }: ReceiptPhotoProps) {
  const t = useTranslations('entry');
  const tCommon = useTranslations('common');
  const url = useObjectUrl(photo);
  const [isBusy, setIsBusy] = React.useState(false);
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);

  const handleFile = async (file: File) => {
    setIsBusy(true);
    try {
      onChange(await compressPhoto(file));
    } catch (err) {
      console.error(err);
      toast.error(t('photoFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = () => {
    const previous = photo;
    setIsViewerOpen(false);
    onChange(null);
    toast(t('photoRemoved'), {
      action: { label: tCommon('undo'), onClick: () => onChange(previous) },
      duration: 6000,
      // The sheet is still open: show it above the sheet, and let it be tapped through the sheet's modal layer
      position: 'top-center',
      style: { pointerEvents: 'auto' },
    });
  };

  if (isBusy) {
    return (
      <div className={CHIP} aria-busy="true" aria-label={t('photo')}>
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!url) {
    return (
      <label className={CHIP}>
        <Camera className="size-6" />
        <CameraInput onFile={handleFile} label={t('addPhoto')} />
      </label>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setIsViewerOpen(true)} aria-label={t('viewPhoto')} className={CHIP}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
        <img src={url} alt="" className="size-full object-cover" />
      </button>

      <DialogPrimitive.Root open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[60] flex flex-col bg-black pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          >
            <div className="flex items-center justify-between px-4">
              <DialogPrimitive.Title className="text-heading font-semibold text-white">{t('photo')}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label={t('closePhoto')}
                className="flex size-12 items-center justify-center rounded-full bg-white/15 text-white transition-transform active:scale-95 cursor-pointer"
              >
                <X className="size-6" />
              </DialogPrimitive.Close>
            </div>

            <ZoomableImage src={url} alt={t('viewPhoto')} />

            <div className="flex gap-3 px-4">
              <label className={VIEWER_BUTTON}>
                <RefreshCw className="size-5" />
                {t('replacePhoto')}
                <CameraInput
                  label={t('replacePhoto')}
                  onFile={(file) => {
                    setIsViewerOpen(false);
                    void handleFile(file);
                  }}
                />
              </label>
              <button type="button" onClick={handleRemove} className={VIEWER_BUTTON}>
                <Trash2 className="size-5" />
                {t('removePhoto')}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

const MAX_ZOOM = 4;

/** Photo that can be pinch-zoomed and panned (only here: the app itself never zooms). Double-tap toggles zoom. */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [view, setView] = React.useState({ scale: 1, x: 0, y: 0 });
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const pinch = React.useRef<{ distance: number; scale: number } | null>(null);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinch.current = { distance: distance(), scale: view.scale };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const start = pinch.current;
      const scale = Math.min(MAX_ZOOM, Math.max(1, (start.scale * distance()) / start.distance));
      setView((v) => ({ ...v, scale }));
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      setView((v) => (v.scale > 1 ? { ...v, x: v.x + dx, y: v.y + dy } : v));
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    setView((v) => (v.scale <= 1 ? { scale: 1, x: 0, y: 0 } : v));
  };

  return (
    <div
      className="relative my-3 flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }))}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
    </div>
  );
}
