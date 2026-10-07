import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { SerwistProvider } from '@serwist/turbopack/react';
import { SwUpdater } from '@/components/layout/SwUpdater';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { type Locale, routing } from '@/i18n/routing';
import { STARTUP_IMAGES } from '../startup-images';
import '../globals.css';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Family Accounts',
  description: 'Household money, made simple',
  applicationName: 'Family Accounts',
  appleWebApp: {
    capable: true,
    title: 'Family Accounts',
    statusBarStyle: 'default',
    startupImage: STARTUP_IMAGES,
  },
  formatDetection: { telephone: false },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF8F5' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
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
      <head>
        {STARTUP_IMAGES.map((img) => (
          <link
            key={img.url}
            rel="apple-touch-startup-image"
            href={img.url}
            media={img.media}
          />
        ))}
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SerwistProvider
            swUrl="/serwist/sw.js"
            disable={process.env.NODE_ENV !== 'production'}
          >
            <SwUpdater />
            {children}
          </SerwistProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
