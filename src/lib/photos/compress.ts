// =========================================================
// Receipt photo compression  ·  Family Accounts (حساباتنا)
// Shrinks a camera photo on the phone before it is stored:
// longest side 1600px, JPEG (or WebP) at 0.8, aiming for ≤ 300 KB.
// =========================================================

export const MAX_SIDE = 1600;
export const MIN_SIDE = 800;
export const START_QUALITY = 0.8;
export const MIN_QUALITY = 0.5;
export const TARGET_BYTES = 300 * 1024;

export interface Attempt {
  maxSide: number;
  quality: number;
}

/** Scales width × height so the longest side is at most `maxSide`. Never upscales. */
export function fitWithin(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest === 0) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * What to try next when the output is still over the target:
 * lower the quality in 0.1 steps down to 0.5, then shrink the image by 20% (not below 800px).
 * Returns null when there is nothing left to try (the smallest result is kept).
 */
export function nextAttempt({ maxSide, quality }: Attempt): Attempt | null {
  if (quality - 0.1 >= MIN_QUALITY - 1e-9) {
    return { maxSide, quality: Math.round((quality - 0.1) * 10) / 10 };
  }
  const smaller = Math.round(maxSide * 0.8);
  if (smaller >= MIN_SIDE) return { maxSide: smaller, quality };
  return null;
}

// ---------- Browser-only part (canvas) ----------

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<{ source: Source; width: number; height: number; release: () => void }> {
  // EXIF orientation is applied here, so a portrait receipt stays upright
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Older Safari: an <img> also honours EXIF orientation
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function encode(source: Source, width: number, height: number, type: string, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Compresses a photo for storage. Output is always image/webp or image/jpeg. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const { source, width, height, release } = await decode(file);
  try {
    let type = 'image/webp';
    let attempt: Attempt | null = { maxSide: MAX_SIDE, quality: START_QUALITY };
    let best: Blob | null = null;

    while (attempt) {
      const size = fitWithin(width, height, attempt.maxSide);
      let blob = await encode(source, size.width, size.height, type, attempt.quality);
      // Browsers without WebP encoding hand back PNG instead: switch to JPEG for good
      if (blob && blob.type !== type) {
        type = 'image/jpeg';
        blob = await encode(source, size.width, size.height, type, attempt.quality);
      }
      if (!blob) break;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_BYTES) break;
      attempt = nextAttempt(attempt);
    }

    if (!best) throw new Error('Could not compress photo');
    return best;
  } finally {
    release();
  }
}
