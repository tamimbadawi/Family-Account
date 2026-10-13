import { NextResponse } from 'next/server';
import { parseOffersCsv } from '@/lib/offers/parse';

export const dynamic = 'force-dynamic';

// The "offers" tab of the public, read-only Bank Offers Google Sheet (the bank-offers app's data).
// OFFERS_CSV_URL overrides it.
const DEFAULT_OFFERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRXmD2AKuwo9gMXiaJF3clZws0msaOmTEiFWhVd_8mxQg5wmXw6NDk9uB-azPwxAL0OfbsaIubwVH6l/pub?single=true&output=csv&gid=1504478823';

const SIX_HOURS = 6 * 60 * 60;

export async function GET() {
  try {
    const res = await fetch(process.env.OFFERS_CSV_URL || DEFAULT_OFFERS_CSV_URL, {
      next: { revalidate: SIX_HOURS },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { offers, error } = parseOffersCsv(await res.text());
    if (error) throw new Error('The offers sheet could not be read');

    return NextResponse.json(
      { ok: true, offers },
      { headers: { 'Cache-Control': `public, s-maxage=${SIX_HOURS}, stale-while-revalidate=86400` } },
    );
  } catch (err) {
    console.error('Loading bank offers failed:', err);
    return NextResponse.json(
      { ok: false, offers: [] },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
