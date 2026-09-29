import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';
// FleetVu Mobile Command — root layout

export const metadata: Metadata = {
  title: 'FleetVu Vault',
  description:
    'FleetVu Forensic Vault — SCFuels C55-Pro evaluation, sealed telemetry, and driver safety.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Vault',
  appleWebApp: {
    capable: true,
    title: 'Vault',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'FleetVu Vault',
    description:
      'FleetVu Forensic Vault — SCFuels C55-Pro evaluation, sealed telemetry, and driver safety.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0F172A" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
