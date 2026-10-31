'use client';

import { useEffect } from 'react';
import { setPublicVaultOpen } from '@/lib/public-vault-gate';
import { setScfuelsPilotSticky } from '@/lib/scfuels-trial';

/**
 * Client bridge after server validates the secret.
 * Lands on #vault-live (Default View Vault), unlocked for CISBO / staff review.
 */
export function VaultOpenBridge() {
  useEffect(() => {
    setPublicVaultOpen(true);
    const params = new URLSearchParams(window.location.search);
    const pilot = (params.get('pilot') || '').trim().toLowerCase();
    const scfuels =
      pilot === 'scfuels' || pilot === 'sc-fuels' || pilot === 'scf';
    if (scfuels) {
      setScfuelsPilotSticky(true);
      window.location.replace('/?pilot=scfuels#demo-scfuels');
      return;
    }
    setScfuelsPilotSticky(false);
    window.location.replace('/#vault-live');
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-slate-200 flex items-center justify-center p-6">
      <p className="text-sm text-amber-300/90">Opening secured Vault demo…</p>
    </main>
  );
}
