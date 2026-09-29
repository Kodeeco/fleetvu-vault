import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FleetVu Mobile Command',
    short_name: 'FleetVu',
    description:
      'Advanced fleet telemetry, incident reconstruction, and driver safety platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#F97316',
    orientation: 'any',
    categories: ['business', 'navigation', 'productivity'],
    icons: [
      {
        src: '/icon-192.webp',
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.webp',
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'maskable',
      },
    ],
  };
}
