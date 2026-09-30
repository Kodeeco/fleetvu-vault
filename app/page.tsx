'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { PortalAccessBar } from '@/components/landing/portal-access-bar';

const AppContent = dynamic(() => import('@/components/app-content'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
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

/** Dev-only portal switcher — never on production (blocked Cancel / covered UI). */
function useShowJumpBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const host = window.location.hostname;
      const local = host === 'localhost' || host === '127.0.0.1';
      const forced = new URLSearchParams(window.location.search).get('jump') === '1';
      setShow(local || forced);
    } catch {
      setShow(false);
    }
  }, []);
  return show;
}

export default function Home() {
  const showJump = useShowJumpBar();
  return (
    <>
      {showJump && <PortalAccessBar />}
      <AppContent />
    </>
  );
}
