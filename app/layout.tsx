import './globals.css';
import type { Metadata } from 'next';

// Avoid next/font/google on Netlify Linux builds — Google CSS fetch is flaky
// and can crash the font loader mid-compile.
const inter = { className: 'fv-font-sans' };

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
