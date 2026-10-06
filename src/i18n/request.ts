import { getRequestConfig } from 'next-intl/server';
import { type Locale, routing } from './routing';

const namespaces = [
  'app',
  'nav',
  'common',
  'sync',
  'home',
  'entry',
  'history',
  'reports',
  'settings',
  'auth',
  'install',
  'offline'
] as const;

function isAppLocale(locale: string | undefined): locale is Locale {
  return typeof locale === 'string' && (routing.locales as readonly string[]).includes(locale);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isAppLocale(requested) ? requested : routing.defaultLocale;

  const messages: Record<string, unknown> = {};

  for (const ns of namespaces) {
    const mod = await import(`../../messages/${locale}/${ns}.json`);
    messages[ns] = mod.default;
  }

  return {
    locale,
    messages
  };
});
