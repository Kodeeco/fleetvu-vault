'use client';

import dynamic from 'next/dynamic';
import { PortalAccessBar } from '@/components/landing/portal-access-bar';

const AppContent = dynamic(() => import('@/components/app-content'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center pt-12">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/FV-Vault-logo-gold.png"
          alt="FleetVu Vault"
          className="h-20 w-auto mx-auto mb-4 object-contain drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]"
        />
        <p className="text-slate-400 text-sm">Loading FleetVu Mobile Command...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <>
      {/* Always mounted — independent of app session / portal state */}
      <PortalAccessBar />
      <AppContent />
    </>
  );
}
