---
description: Step A3c — optional receipt photo on an entry (camera capture, on-phone compression, thumbnail, full-screen viewer), stored locally in mock mode.
---

# A3c · Receipt photo

Precondition: A3b and A4 are merged. You own `src/components/entry/**`.
Read `AGENTS.md`, `docs/DESIGN.md` §4 "Add / Edit entry" (review strip) and `supabase/migrations/0004_receipt_photos.sql`.

The database already has `transactions.photo_path` and a private Storage bucket `receipts` (path `<household_id>/<transaction_id>.jpg`).
In this step (mock mode) photos live **only on the phone**; Phase B (B3) uploads them through the outbox.

1. Data: add `photoPath?: string | null` to the Entry type/mappers, and a Dexie table `photos` (`id` = transaction id, `blob`, `createdAt`) in `src/lib/offline/db.ts` as **version 2** (keep version 1 intact so existing phones upgrade cleanly). Repository: `setEntryPhoto(entryId, blob)`, `getEntryPhoto(entryId)`, `removeEntryPhoto(entryId)` (removal just clears `photoPath`; nothing is hard-deleted on the server later). Update both the interface and the mock implementation. Add tests.
2. Compression helper `src/lib/photos/compress.ts`: decode → longest side 1600px → JPEG quality 0.8 (WebP if supported) → target ≤ 300 KB; honour EXIF orientation (use `createImageBitmap(file, { imageOrientation: 'from-image' })`). Pure function around canvas, with a unit test for the size maths.
3. UI in the Add/Edit sheet review strip: a **📷 Photo** chip next to Date / Wallet / Note. Tap → `<input type="file" accept="image/*" capture="environment">` (opens the camera on iPhone; Android offers camera or gallery). After capture: small rounded thumbnail in the chip; tap thumbnail → full-screen viewer (pinch-zoom allowed only inside the viewer) with **Replace** and **Remove** (Remove shows an Undo toast, no dialog).
4. History rows show a tiny paperclip/photo icon when an entry has a photo.
5. Everything still fits 390×844 without scrolling; strings in `messages/{en,ar}/entry.json`.
6. Quick `/design-review` (sheet with and without photo, viewer, `/en` + `/ar`), then Definition of Done.
