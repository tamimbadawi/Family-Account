import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

// Pages anyone may open without signing in
const PUBLIC_PAGES = ['/login', '/install', '/styleguide'];

function pathWithoutLocale(pathname: string): string {
  const [, maybeLocale, ...rest] = pathname.split('/');
  return (routing.locales as readonly string[]).includes(maybeLocale) ? '/' + rest.join('/') : pathname;
}

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // No Supabase configured (local sample-data mode): the app stays open, as in Phase A
  if (!url || !key || response.headers.get('location')) return response;

  // Refresh the session cookies on every request (they travel with the i18n response)
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();

  const path = pathWithoutLocale(request.nextUrl.pathname);
  const isPublic = PUBLIC_PAGES.some((p) => path === p || path.startsWith(p + '/'));
  if (!data?.claims && !isPublic) {
    const locale = request.nextUrl.pathname.split('/')[1];
    const login = request.nextUrl.clone();
    login.pathname = `/${(routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale}/login`;
    login.search = '';
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export default proxy;

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next`, `/_vercel`, `/~offline` or `/serwist`
  // - … the ones containing a dot (e.g. `favicon.ico`, `sw.js`, the manifest and icons)
  matcher: ['/((?!api|_next|_vercel|~offline|serwist|.*\..*).*)']
};
