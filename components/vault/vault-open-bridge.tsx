'use client';

import { useEffect } from 'react';
import { setPublicVaultOpen } from '@/lib/public-vault-gate';
import { setScfuelsPilotSticky } from '@/lib/scfuels-trial';

/** Client bridge after server validates the secret. */
export function VaultOpenBridge() {
  useEffect(() => {
    setPublicVaultOpen(true);
    // Preserve pilot branding across redirect to bare /.
    const params = new URLSearchParams(window.location.search);
    const pilot = (params.get('pilot') || '').trim().toLowerCase();
    const scfuels =
      pilot === 'scfuels' || pilot === 'sc-fuels' || pilot === 'scf';
    if (scfuels) setScfuelsPilotSticky(true);
    else setScfuelsPilotSticky(false);
    window.location.replace(scfuels ? '/?pilot=scfuels' : '/');
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-slate-200 flex items-center justify-center p-6">
      <p className="text-sm text-amber-300/90">Opening secured Vault demo…</p>
    </main>
  );
}
