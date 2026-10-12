/** "5 minutes ago", "3 days ago" … in the reader's language, always with Western digits. */
export function timeAgo(iso: string, locale: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith('ar') ? 'ar-EG' : 'en', {
    numeric: 'auto',
    numberingSystem: 'latn',
  } as Intl.RelativeTimeFormatOptions);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), 'month');
  return rtf.format(Math.round(seconds / (86400 * 365)), 'year');
}
