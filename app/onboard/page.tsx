'use client';

import React, { useMemo, useState } from 'react';
import { DriverOnboardingScreen } from '@/components/auth/driver-onboarding-screen';
import { Button } from '@/components/ui/button';

/**
 * Dual-path driver registration entry (Part 2.1)
 * Welcome / activation links should land here:
 *   https://app.fleetvu.org/onboard?email=…&companyId=…&driverId=…
 */
export default function DriverOnboardPage() {
  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const email = params.get('email') || '';
  const companyId = params.get('companyId');
  const driverId = params.get('driverId');
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen bg-[#05070b] text-slate-100 flex flex-col items-center justify-center p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/FV-Vault-logo-gold.png"
        alt="FleetVu Vault"
        className="h-16 w-auto mb-6 object-contain drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]"
      />
      <h1 className="text-xl font-bold text-white mb-2">Driver Secure Onboarding</h1>
      <p className="text-sm text-slate-400 text-center max-w-md mb-6">
        Choose biometric fingerprint (recommended) or a secure KEY-Code. Terminal supervisors can issue a 15-minute PIN for loaner devices.
      </p>
      {!email ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 max-w-md text-center">
          Missing driver email. Open this page from your welcome link, or add{' '}
          <code className="text-amber-300">?email=you@company.com</code>.
        </div>
      ) : done ? (
        <div className="text-center space-y-4">
          <p className="text-emerald-300 font-semibold">Onboarding complete. You can open the Vault app.</p>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { window.location.href = '/'; }}>
            Open FleetVu Vault
          </Button>
        </div>
      ) : (
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setOpen(true)}>
          Continue Authentication Setup
        </Button>
      )}

      {email && (
        <DriverOnboardingScreen
          open={open}
          onClose={() => setOpen(false)}
          driverEmail={email}
          driverId={driverId}
          companyId={companyId}
          onComplete={() => {
            setDone(true);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
