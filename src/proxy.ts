import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export default handleI18nRouting;
export { handleI18nRouting as proxy };

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next`, `/_vercel`, `/~offline` or `/serwist`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|_next|_vercel|~offline|serwist|.*\\..*).*)']
};
