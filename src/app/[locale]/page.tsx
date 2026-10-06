import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="min-h-screen p-8 flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-bold mb-2">{t('app.name')}</h1>
      <p className="text-lg text-gray-600 mb-6">{t('app.tagline')}</p>
      <div className="flex gap-4">
        <Link
          href="/"
          locale="en"
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          English
        </Link>
        <Link
          href="/"
          locale="ar"
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          العربية
        </Link>
      </div>
    </main>
  );
}
