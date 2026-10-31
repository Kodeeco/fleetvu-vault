'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Shield } from 'lucide-react';

function ShareInner() {
  const params = useSearchParams();
  const t = params.get('t') || '';

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-200 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-slate-700 bg-slate-900/90 p-6 text-center space-y-3">
        <Shield className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Secure incident package</h1>
        {t ? (
          <>
            <p className="text-sm text-slate-400 leading-relaxed">
              This link was issued from a FleetVu Fleet Account Portal. Full package viewer (photos,
              licenses, insurance cards, GPS stamps) is being wired to this token.
            </p>
            <p className="text-[10px] font-mono text-slate-500 break-all">token …{t.slice(-12)}</p>
          </>
        ) : (
          <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Missing share token.
          </p>
        )}
        <p className="text-[10px] text-slate-600">Powered by FleetVu Vault · access is audited</p>
      </div>
    </div>
  );
}

export default function IncidentSharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1220] text-slate-400 flex items-center justify-center">
          Loading…
        </div>
      }
    >
      <ShareInner />
    </Suspense>
  );
}
