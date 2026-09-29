import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';
// FleetVu Mobile Command — root layout

export const metadata: Metadata = {
  title: 'FleetVu Mobile Command',
  description:
    'FleetVu Mobile Command — Advanced fleet telemetry, incident reconstruction, and driver safety platform.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'FleetVu Command',
    statusBarStyle: 'black-translucent',
  },
  applicationName: 'FleetVu',
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'FleetVu Mobile Command',
    description:
      'Advanced fleet telemetry, incident reconstruction, and driver safety platform.',
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
        <meta name="theme-color" content="#F97316" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
