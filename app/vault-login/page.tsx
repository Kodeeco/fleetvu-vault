'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setFleetSession } from '@/components/fleet-account/fleet-account-panels';

/**
 * Canonical customer entrance: https://app.fleetvu.org/vault-login
 * FleetVu Vault Portal only — not HubSpot, not Ops CRM.
 */
export default function VaultLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/fleet-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login_email',
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-in failed');
      if (data.sessionToken) setFleetSession(data.sessionToken);
      if (!data.portalToken) throw new Error('No portal workspace bound to this account yet.');
      router.push(`/portal?token=${encodeURIComponent(data.portalToken)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 shadow-2xl p-8 space-y-5">
        <div className="text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FV-Vault3.png" alt="FleetVu Vault" className="h-16 mx-auto object-contain" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">
            Vault Portal
          </p>
          <h1 className="text-2xl font-bold text-white">Sign in to your fleet account</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your company&apos;s Vault: users &amp; roles, safety reports, driver roster, incident
            shares, portal settings, and audit.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold">Work email</label>
          <Input
            className="h-10 bg-slate-950 border-slate-700 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="director@yourfleet.com"
            autoComplete="username"
          />
          <label className="text-[10px] uppercase text-slate-500 font-bold">Password</label>
          <Input
            type="password"
            className="h-10 bg-slate-950 border-slate-700 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void login();
            }}
          />
        </div>

        {msg && <p className="text-xs text-amber-200/90 leading-relaxed">{msg}</p>}

        <Button
          disabled={busy || !email || !password}
          className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
          onClick={() => void login()}
        >
          <Shield className="w-4 h-4 mr-2" />
          Enter Vault Portal
        </Button>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          First time? Open the welcome email link once, set your password under{' '}
          <strong className="text-slate-400">Login</strong>, then always return to{' '}
          <span className="text-amber-300/90">app.fleetvu.org/vault-login</span>
        </p>
      </div>
    </div>
  );
}
