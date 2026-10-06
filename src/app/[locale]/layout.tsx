import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { type Locale, routing } from '@/i18n/routing';
import '../globals.css';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Family Accounts',
  description: 'Household money, made simple'
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function isAppLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={ibmPlexArabic.variable}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
