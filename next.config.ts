import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSerwist } from '@serwist/turbopack';

const withNextIntl = createNextIntlPlugin();

// Production only: scripts may come from this app and nowhere else. This keeps third-party
// scripts out, including the Vercel Toolbar (vercel.live) that Vercel injects for logged-in
// team members — the family never sees it, but it covers the tab bar on the maintainer's phone.
// Inline scripts stay allowed because Next.js and next-themes rely on them.
const productionCsp = [
  "script-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

const nextConfig: NextConfig = {
  turbopack: {},
  devIndicators: false,
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: productionCsp }] }];
  },
};

export default withSerwist(withNextIntl(nextConfig));
