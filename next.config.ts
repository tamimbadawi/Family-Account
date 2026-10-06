import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSerwist } from '@serwist/turbopack';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  turbopack: {},
  devIndicators: false,
};

export default withSerwist(withNextIntl(nextConfig));
