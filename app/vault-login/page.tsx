'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setMsg('Enter your work email and password.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/fleet-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login_email',
          email: trimmed,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = String(data.error || 'Sign-in failed');
        if (res.status === 401 && /no vault portal password/i.test(err)) {
          throw new Error(
            'No password set for this email yet. Open your welcome email link once, choose Login, set a password, then return here.',
          );
        }
        if (res.status === 409) {
          throw new Error(
            'Signed in, but no active fleet portal was found. Ask FleetVu to resend your onboarding link.',
          );
        }
        if (res.status === 401) {
          throw new Error('Incorrect email or password. Check caps lock, then try again.');
        }
        throw new Error(err);
      }
      if (data.sessionToken) setFleetSession(data.sessionToken);
      if (!data.portalToken) {
        throw new Error(
          'No portal workspace bound to this account yet. Ask FleetVu to resend onboarding.',
        );
      }
      router.push(`/portal?token=${encodeURIComponent(data.portalToken)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-200 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FV-Vault3.png" alt="FleetVu Vault" className="h-14 sm:h-16 mx-auto object-contain" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80 font-semibold">
            patent pending: 64-036,221
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">
            Vault Portal
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Sign in to your fleet account</h1>
          <p className="text-xs text-slate-400 leading-relaxed px-1">
            Your company&apos;s Vault: users &amp; roles, safety reports, driver roster, incident
            shares, portal settings, and audit.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="vault-email" className="text-[10px] uppercase text-slate-500 font-bold">
            Work email
          </label>
          <Input
            id="vault-email"
            type="email"
            className="h-10 bg-slate-950 border-slate-700 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="director@yourfleet.com"
            autoComplete="username"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void login();
            }}
          />
          <label htmlFor="vault-password" className="text-[10px] uppercase text-slate-500 font-bold">
            Password
          </label>
          <div className="relative">
            <Input
              id="vault-password"
              type={showPassword ? 'text' : 'password'}
              className="h-10 bg-slate-950 border-slate-700 text-sm pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void login();
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {msg && (
          <p
            role="alert"
            className="text-xs text-amber-100/95 leading-relaxed rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
          >
            {msg}
          </p>
        )}

        <Button
          disabled={busy || !email.trim() || !password}
          className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
          onClick={() => void login()}
        >
          <Shield className="w-4 h-4 mr-2" />
          {busy ? 'Signing in…' : 'Enter Vault Portal'}
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
