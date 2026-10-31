'use client';

import { useEffect } from 'react';
import { setPublicVaultOpen } from '@/lib/public-vault-gate';

/**
 * Force public Vault back to LOCKED for this browser session:
 *   https://app.fleetvu.org/vault-locked
 */
export default function VaultLockedPage() {
  useEffect(() => {
    setPublicVaultOpen(false);
    window.location.replace('/');
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-slate-200 flex items-center justify-center p-6">
      <p className="text-sm text-red-300/90">Locking Vault…</p>
    </main>
  );
}
