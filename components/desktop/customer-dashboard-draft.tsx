'use client';

/**
 * SECONDARY DRAFT — Customer Portal UX proposal
 * Route: /customer-dashboard-draft
 * Does not replace the live command center. Review-only theme & IA.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Lock,
  MapPin,
  Radar,
  Settings,
  Shield,
  Truck,
  Unlock,
  Users,
  Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'live' | 'incidents' | 'vault' | 'company';

const TABS: { id: TabId; label: string; blurb: string }[] = [
  { id: 'live', label: 'Live Fleet', blurb: 'Are we safe right now?' },
  { id: 'incidents', label: 'Incidents', blurb: 'What needs review?' },
  { id: 'vault', label: 'Vault & Reports', blurb: 'Prove it / export it' },
  { id: 'company', label: 'Company', blurb: 'Who is on the system?' },
];

const MOCK_INCIDENTS = [
  {
    id: 'FV-M9K2-A1B2',
    file: 'INCIDENT_20260928-214412_Apex_Logistics_J_Martinez_FV-M9K2-A1B2',
    driver: 'J. Martinez',
    truck: '#072',
    when: '12 min ago',
    status: 'new' as const,
    lat: 32.7157,
    lng: -117.1611,
    photos: 5,
  },
  {
    id: 'FV-M8H1-C3D4',
    file: 'INCIDENT_20260927-163301_Apex_Logistics_R_Chen_FV-M8H1-C3D4',
    driver: 'R. Chen',
    truck: '#118',
    when: 'Yesterday',
    status: 'reviewed' as const,
    lat: 32.8328,
    lng: -117.1012,
    photos: 4,
  },
];

const MOCK_UNITS = [
  { truck: '#072', driver: 'J. Martinez', post: 'completed' as const, zone: 'safe' as const, speed: 48 },
  { truck: '#118', driver: 'R. Chen', post: 'completed' as const, zone: 'caution' as const, speed: 32 },
  { truck: '#203', driver: 'A. Brooks', post: 'pending' as const, zone: 'safe' as const, speed: 0 },
];

export function CustomerDashboardDraft() {
  const [tab, setTab] = useState<TabId>('live');
  const [selectedIncident, setSelectedIncident] = useState(MOCK_INCIDENTS[0].id);
  const vaultDays = 278;
  const vaultOpen = vaultDays > 0;

  const selected = useMemo(
    () => MOCK_INCIDENTS.find((i) => i.id === selectedIncident) || MOCK_INCIDENTS[0],
    [selectedIncident],
  );

  return (
    <div className="min-h-screen text-slate-100" style={{ background: 'linear-gradient(165deg, #05070b 0%, #0a1220 42%, #081018 100%)' }}>
      {/* Draft banner */}
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-amber-100/90">
          <span className="font-bold text-amber-300">DRAFT THEME</span>
          {' — '}
          Secondary customer portal proposal. Does not change your live Command Center.
        </p>
        <Link href="/" className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline">
          ← Back to live app
        </Link>
      </div>

      {/* Top bar */}
      <header className="border-b border-white/5 bg-[#070b12]/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/FV-Vault-logo-gold.png"
              alt="FleetVu"
              className="h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(251,191,36,0.35)]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/FV.jpg';
              }}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white tracking-tight truncate">Apex Logistics</p>
              <p className="text-[10px] text-slate-500 truncate">Customer Portal · Standalone Vault</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <VaultPill open={vaultOpen} days={vaultDays} />
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-300"
              aria-label="Incident alerts"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white">
                1
              </span>
            </button>
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* Primary nav — 4 jobs only */}
      <nav className="border-b border-white/5 bg-[#0a1018]/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin py-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'shrink-0 rounded-lg px-4 py-2.5 text-left transition-colors',
                    active
                      ? 'bg-orange-500/20 border border-orange-500/45 text-white'
                      : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200',
                  )}
                >
                  <div className="text-[12px] font-bold tracking-wide">{t.label}</div>
                  <div className="text-[10px] text-slate-500 hidden sm:block">{t.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {tab === 'live' && <LiveFleetTab units={MOCK_UNITS} onOpenIncidents={() => setTab('incidents')} />}
        {tab === 'incidents' && (
          <IncidentsTab
            incidents={MOCK_INCIDENTS}
            selectedId={selected.id}
            selected={selected}
            onSelect={setSelectedIncident}
          />
        )}
        {tab === 'vault' && <VaultTab vaultOpen={vaultOpen} days={vaultDays} />}
        {tab === 'company' && <CompanyTab />}
      </main>
    </div>
  );
}

function VaultPill({ open, days }: { open: boolean; days: number }) {
  return (
    <div
      className={cn(
        'hidden md:inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold',
        open
          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/40 bg-red-500/15 text-red-300',
      )}
    >
      {open ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {open ? `Vault OPEN · ${days}d` : 'Vault LOCKED'}
    </div>
  );
}

function LiveFleetTab({
  units,
  onOpenIncidents,
}: {
  units: typeof MOCK_UNITS;
  onOpenIncidents: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* One composition hero */}
      <section
        className="relative overflow-hidden rounded-2xl border border-cyan-500/25"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(14,116,144,0.28), transparent 55%), linear-gradient(180deg, #071018 0%, #050a12 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative px-5 sm:px-8 pt-6 pb-5 flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80 mb-2">Live Fleet</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/FV-Vault-logo-gold.png"
              alt="FleetVu Vault"
              className="h-10 sm:h-12 w-auto object-contain mb-3"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight max-w-lg leading-tight">
              Forward · Left · Right monitoring is live
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-md">
              Standalone Vault — no TMS required. One alert rail. One status for the Vault.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusChip icon={<Wifi className="h-3 w-3" />} label="3 units linked" tone="emerald" />
              <StatusChip icon={<Shield className="h-3 w-3" />} label="POST: 2/3 fresh" tone="amber" />
              <StatusChip icon={<Activity className="h-3 w-3" />} label="SHA-256 sealing ON" tone="emerald" />
            </div>
          </div>

          {/* Radar stage — single visual hero */}
          <div className="w-full lg:w-[340px] shrink-0">
            <div className="relative aspect-square rounded-xl border border-cyan-500/30 bg-[#041018] overflow-hidden">
              <RadarStage />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px]">
                <span className="inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-emerald-300 font-bold border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
                <span className="rounded-md bg-black/70 px-2 py-1 text-slate-300 font-mono border border-white/10">
                  32.716, -117.161
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Single alert rail */}
      <button
        type="button"
        onClick={onOpenIncidents}
        className="w-full text-left rounded-xl border border-orange-500/40 bg-gradient-to-r from-orange-500/20 to-orange-500/5 px-4 py-3.5 flex items-center gap-3 hover:from-orange-500/30 transition-colors"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 text-white shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">1 new incident ready for review</p>
          <p className="text-[11px] text-orange-100/70 truncate">
            J. Martinez · #072 · sealed package waiting in Incidents
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-300 shrink-0">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </button>

      {/* Compact unit strip — not a widget dump */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">Units</h2>
          <p className="text-[10px] text-slate-500">Company-locked ranges · driver cannot change</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {units.map((u) => (
            <div
              key={u.truck}
              className="rounded-xl border border-white/8 bg-[#0c1219]/90 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-white text-sm">{u.truck}</span>
                </div>
                <ZoneDot zone={u.zone} />
              </div>
              <p className="mt-1 text-[11px] text-slate-400 truncate">{u.driver}</p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 tabular-nums">{u.speed} mph</span>
                <span
                  className={cn(
                    'font-bold uppercase tracking-wide',
                    u.post === 'completed' ? 'text-emerald-400' : 'text-orange-400',
                  )}
                >
                  POST {u.post === 'completed' ? 'OK' : 'RUN'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function IncidentsTab({
  incidents,
  selectedId,
  selected,
  onSelect,
}: {
  incidents: typeof MOCK_INCIDENTS;
  selectedId: string;
  selected: (typeof MOCK_INCIDENTS)[0];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-white">Incidents</h1>
        <p className="text-sm text-slate-400 mt-1">
          Live reconstruction files land here — sealed, company-owned, never FleetVu Global Admin.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-h-[420px]">
        <aside className="rounded-xl border border-white/8 bg-[#0c1219] overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Cases
          </div>
          <div className="flex-1 overflow-y-auto">
            {incidents.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => onSelect(inc.id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-white/5 transition-colors',
                  selectedId === inc.id ? 'bg-orange-500/15' : 'hover:bg-white/5',
                )}
              >
                <div className="flex items-center gap-2">
                  {inc.status === 'new' ? (
                    <span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white truncate">{inc.id}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">
                  {inc.driver} · {inc.truck} · {inc.when}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-orange-500/25 bg-[#0c1219] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/80">Completed report</p>
              <h2 className="text-lg font-bold text-white mt-0.5">{selected.id}</h2>
              <p className="text-[11px] text-slate-500 font-mono break-all mt-1">{selected.file}</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white"
            >
              Open Reconstruction
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-5 grid sm:grid-cols-2 gap-4 flex-1">
            <div className="space-y-3">
              <MetaRow icon={<Users className="h-3.5 w-3.5" />} label="Driver" value={selected.driver} />
              <MetaRow icon={<Truck className="h-3.5 w-3.5" />} label="Truck" value={selected.truck} />
              <MetaRow icon={<MapPin className="h-3.5 w-3.5" />} label="GPS" value={`${selected.lat}, ${selected.lng}`} />
              <MetaRow icon={<FileText className="h-3.5 w-3.5" />} label="Evidence photos" value={`${selected.photos} sealed`} />
              <MetaRow icon={<Shield className="h-3.5 w-3.5" />} label="Package" value="SHA-256 · customer tenant" />
            </div>
            <div
              className="rounded-xl border border-cyan-500/20 min-h-[180px] flex items-center justify-center relative overflow-hidden"
              style={{ background: 'radial-gradient(circle at 40% 40%, rgba(14,116,144,0.35), #050a12 70%)' }}
            >
              <div className="text-center px-4">
                <Radar className="h-8 w-8 text-cyan-400/80 mx-auto mb-2" />
                <p className="text-xs font-bold text-cyan-100">Reconstruction canvas</p>
                <p className="text-[10px] text-slate-500 mt-1">F / L / R grille channels + timeline</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function VaultTab({ vaultOpen, days }: { vaultOpen: boolean; days: number }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Vault &amp; Reports</h1>
        <p className="text-sm text-slate-400 mt-1">
          Binary model: Vault OPEN (sealed &amp; secured) or LOCKED (PDF still downloads, unsealed).
        </p>
      </div>

      <div
        className={cn(
          'rounded-2xl border px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4',
          vaultOpen ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/35 bg-red-500/10',
        )}
      >
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl shrink-0',
            vaultOpen ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300',
          )}
        >
          {vaultOpen ? <Unlock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-black text-white">{vaultOpen ? 'Forensic Vault OPEN' : 'Forensic Vault LOCKED'}</p>
          <p className="text-sm text-slate-300 mt-0.5">
            {vaultOpen
              ? `${days} days remaining in complimentary hardware year · SHA-256 sealing active`
              : 'PDFs still download — without SHA-256 seal. Account not secured for forensic use.'}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shrink-0"
        >
          Start Subscription
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <ReportTile
          icon={<FileText className="h-5 w-5 text-amber-400" />}
          title="Safety Log PDF"
          desc={vaultOpen ? 'SHA-256 sealed export' : 'Unsealed PDF only'}
        />
        <ReportTile
          icon={<Gauge className="h-5 w-5 text-cyan-400" />}
          title="Risk Scorecard"
          desc="Actuarial snapshot for insurers"
        />
        <ReportTile
          icon={<Archive className="h-5 w-5 text-slate-300" />}
          title="Archives"
          desc="Company vault of past exports"
        />
      </div>

      <div className="rounded-xl border border-white/8 bg-[#0c1219] px-4 py-3 flex items-start gap-3">
        <Clock className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Reminders at 60 / 30 / 14 / 7 days and day-of LOCK go to Super Admin / Admin only — never drivers.
          Preferred call time + fleet size collect on the sales form → sales@fleetvu.org.
        </p>
      </div>
    </div>
  );
}

function CompanyTab() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Company</h1>
        <p className="text-sm text-slate-400 mt-1">People, assets, and quiet enterprise doors — not the dashboard.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <CompanyLink icon={<Users className="h-4 w-4" />} title="Drivers & seats" desc="Roster, welcome emails, seat counts" />
        <CompanyLink icon={<Truck className="h-4 w-4" />} title="Vehicles & sensors" desc="C55 Pro units, serial binding, POST" />
        <CompanyLink icon={<Building2 className="h-4 w-4" />} title="Users & roles" desc="Super Admin, Admin, Terminal" />
        <CompanyLink icon={<Settings className="h-4 w-4" />} title="Integrations (optional)" desc="OpenAPI & HMAC webhooks — when IT is ready" />
      </div>

      <div className="rounded-xl border border-dashed border-slate-600/80 bg-[#0c1219]/60 px-5 py-6 text-center">
        <p className="text-sm font-bold text-slate-200">Standalone first</p>
        <p className="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">
          Works day one with sensors + phones + this portal. TMS connection is optional — never required to get value.
        </p>
      </div>
    </div>
  );
}

function RadarStage() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(34,211,238,0.25)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="#041018" />
      <circle cx="100" cy="100" r="88" fill="url(#radarGlow)" />
      {[28, 48, 68, 88].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgba(56,189,248,0.22)" strokeWidth="1" />
      ))}
      <line x1="100" y1="12" x2="100" y2="188" stroke="rgba(56,189,248,0.15)" />
      <line x1="12" y1="100" x2="188" y2="100" stroke="rgba(56,189,248,0.15)" />
      {/* truck */}
      <rect x="88" y="90" width="24" height="36" rx="3" fill="#f59e0b" opacity="0.9" />
      <text x="100" y="112" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="700">
        F
      </text>
      {/* channels */}
      <path d="M100 90 L72 48 L128 48 Z" fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.55)" />
      <path d="M88 100 L42 78 L48 118 Z" fill="rgba(251,191,36,0.15)" stroke="rgba(251,191,36,0.45)" />
      <path d="M112 100 L158 78 L152 118 Z" fill="rgba(251,191,36,0.15)" stroke="rgba(251,191,36,0.45)" />
      <text x="100" y="42" textAnchor="middle" fill="#6ee7b7" fontSize="6" fontWeight="600">
        FORWARD
      </text>
      <text x="38" y="100" textAnchor="middle" fill="#fcd34d" fontSize="6" fontWeight="600">
        L
      </text>
      <text x="162" y="100" textAnchor="middle" fill="#fcd34d" fontSize="6" fontWeight="600">
        R
      </text>
    </svg>
  );
}

function StatusChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'emerald' | 'amber';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold',
        tone === 'emerald'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function ZoneDot({ zone }: { zone: 'safe' | 'caution' }) {
  return (
    <span
      className={cn(
        'h-2.5 w-2.5 rounded-full',
        zone === 'safe' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]',
      )}
      title={zone}
    />
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-orange-400/80">{icon}</div>
      <div>
        <p className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
        <p className="text-[13px] text-white font-medium">{value}</p>
      </div>
    </div>
  );
}

function ReportTile({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      className="text-left rounded-xl border border-white/8 bg-[#0c1219] px-4 py-4 hover:border-amber-500/35 transition-colors"
    >
      <div className="mb-2">{icon}</div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
    </button>
  );
}

function CompanyLink({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      className="text-left rounded-xl border border-white/8 bg-[#0c1219] px-4 py-4 flex gap-3 hover:border-cyan-500/30 transition-colors"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-cyan-300 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

export default CustomerDashboardDraft;
