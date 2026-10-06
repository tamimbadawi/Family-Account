import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Family Accounts · حساباتنا',
    short_name: 'Family Accounts',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F5',
    theme_color: '#FAF8F5',
    dir: 'ltr',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
