'use client';

import React from 'react';
import { Building2, Fingerprint, Gauge, Home } from 'lucide-react';

export type PortalJump =
  | 'home'
  | 'demo-vault'
  | 'demo-enterprise'
  | 'demo-accuvu'
  | 'demo-global'
  | 'enterprise-login'
  | 'global-login'
  | 'driver-onboarding';

/** Wipe auth + vault session, then hard-navigate so React state cannot trap you. */
export function forcePortalHref(hash: string) {
  try {
    localStorage.removeItem('fleetvu_user');
    localStorage.removeItem('fleetvu_fleet');
    localStorage.removeItem('fleetvu_vault_phase');
    sessionStorage.setItem('fleetvu_force_portal', hash);
  } catch {
    /* ignore */
  }
  if (typeof window === 'undefined') return;
  const url = `${window.location.pathname}?go=${Date.now()}#${hash}`;
  window.location.replace(url);
}

interface PortalAccessBarProps {
  onJump?: (target: PortalJump) => void;
  currentLabel?: string;
}

/**
 * Permanent top switcher — always visible, one click to any portal.
 * Uses real links + storage wipe so you cannot stay trapped in a session.
 */
export function PortalAccessBar({ currentLabel }: PortalAccessBarProps) {
  return (
    <div
      className="fixed top-0 inset-x-0 z-[2147483646] border-b border-amber-500/40 bg-[#070b12]/96 backdrop-blur-md shadow-lg shadow-black/40"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-2 py-1.5">
        <span className="shrink-0 px-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-400/90">
          Jump
        </span>

        <NavLink
          hash="home"
          active={currentLabel?.includes('Portal Home')}
          icon={<Home className="w-3.5 h-3.5" />}
          label="Home"
        />
        <NavLink
          hash="demo-vault"
          active={currentLabel?.includes('Driver Vault')}
          icon={<Fingerprint className="w-3.5 h-3.5" />}
          label="Vault"
          tone="amber"
        />
        <NavLink
          hash="demo-enterprise"
          active={currentLabel?.includes('Enterprise')}
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Enterprise"
          tone="blue"
        />
        <NavLink
          hash="demo-accuvu"
          active={currentLabel?.includes('AccuVu')}
          icon={<Gauge className="w-3.5 h-3.5" />}
          label="AccuVu"
          tone="emerald"
        />

        <span className="mx-1 h-4 w-px shrink-0 bg-white/15" />

        <NavLink hash="enterprise" label="Ent. Login" subtle />
        <NavLink hash="accuvu" label="AccuVu Login" subtle />
        <NavLink hash="driver" label="Driver Login" subtle />

        {currentLabel && (
          <span className="ml-auto shrink-0 truncate pl-2 text-[10px] text-emerald-400/90">
            Now: {currentLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function NavLink({
  hash,
  label,
  icon,
  active,
  tone,
  subtle,
}: {
  hash: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  tone?: 'amber' | 'blue' | 'violet' | 'emerald';
  subtle?: boolean;
}) {
  const toneCls =
    tone === 'amber'
      ? active
        ? 'border-amber-400 bg-amber-500/25 text-amber-200'
        : 'border-amber-500/35 text-amber-300 hover:bg-amber-500/15'
      : tone === 'blue'
        ? active
          ? 'border-blue-400 bg-blue-500/25 text-blue-200'
          : 'border-blue-500/35 text-blue-300 hover:bg-blue-500/15'
        : tone === 'violet'
          ? active
            ? 'border-violet-400 bg-violet-500/25 text-violet-200'
            : 'border-violet-500/35 text-violet-300 hover:bg-violet-500/15'
          : tone === 'emerald'
            ? active
              ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
              : 'border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/15'
            : active
              ? 'border-white/40 bg-white/15 text-white'
              : subtle
                ? 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                : 'border-white/20 text-slate-200 hover:bg-white/10';

  const href = `/?go=${Date.now()}#${hash}`;

  return (
    <a
      href={href}
      onClick={() => {
        try {
          localStorage.removeItem('fleetvu_user');
          localStorage.removeItem('fleetvu_fleet');
          localStorage.removeItem('fleetvu_vault_phase');
          sessionStorage.setItem('fleetvu_force_portal', hash);
        } catch {
          /* ignore */
        }
        // Do NOT preventDefault — let the browser follow the href
      }}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors no-underline ${toneCls}`}
    >
      {icon}
      {label}
    </a>
  );
}
