'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Building2, ChevronRight, Shield, Lock, Radar, Gauge } from 'lucide-react';

export type GatewayChoice = 'driver' | 'enterprise' | 'accuvu' | 'global';

interface VaultLandingPageProps {
  onSelect: (choice: GatewayChoice, opts?: { demo?: boolean }) => void;
}

/**
 * Gateway landing — Driver, Enterprise, and AccuVu always visible.
 * FleetVu Ops (Global) is staff-only via a secret hotspot on the vault wheel.
 * UX Review demos skip credentials. Deep links handled in app-content.
 */
export function VaultLandingPage({ onSelect }: VaultLandingPageProps) {
  const [mounted, setMounted] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [hovered, setHovered] = useState<'driver' | 'enterprise' | 'accuvu' | null>(null);
  const logoClicks = useRef<{ count: number; last: number }>({ count: 0, last: 0 });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const go = useCallback(
    (choice: GatewayChoice, demo = false) => {
      setHovered(null);
      setDoorOpen(true);
      window.setTimeout(() => {
        onSelect(choice, { demo });
        setDoorOpen(false);
      }, 220);
    },
    [onSelect],
  );

  /** Triple-click the gold Vault mark within 900ms → staff Ops login */
  const onSecretLogoClick = useCallback(() => {
    const now = Date.now();
    if (now - logoClicks.current.last > 900) logoClicks.current.count = 0;
    logoClicks.current.last = now;
    logoClicks.current.count += 1;
    if (logoClicks.current.count >= 3) {
      logoClicks.current.count = 0;
      go('global');
    }
  }, [go]);

  return (
    <div className="h-[100dvh] w-full text-slate-100 flex flex-col overflow-hidden relative bg-[#0a0c10]">
      {/* Vault Door background — matches FleetVu Mobile opening aesthetic */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage: 'url(/Vault-Door.jpg)',
          backgroundPosition: 'center 42%',
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/55 via-black/35 to-black/75" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.55)_100%)]" />

      <div className="shrink-0 border-b border-amber-900/25 bg-black/40 backdrop-blur-md z-20">
        <div className="max-w-[1100px] mx-auto px-4 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onSecretLogoClick}
            className="flex items-center gap-2 text-[11px] font-semibold text-amber-200/80 bg-transparent border-0 p-0 cursor-default"
            title=""
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SECURE PORTAL — app.fleetvu.org
          </button>
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-amber-100/50">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> TLS 1.3</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Zero-Trust</span>
            <span className="flex items-center gap-1"><Radar className="w-3 h-3" /> 77GHz Ready</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 py-3 relative z-20 min-h-0">
        <div className="w-full max-w-[920px] mx-auto flex flex-col justify-center min-h-0">
          <div
            className={`flex flex-col items-center mb-4 sm:mb-5 shrink-0 transition-all duration-700 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
            }`}
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/FV-Vault-logo-gold.png"
                alt="FleetVu Vault"
                className="w-auto h-[72px] sm:h-[96px] object-contain drop-shadow-[0_0_24px_rgba(251,191,36,0.3)] pointer-events-none"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/FV-Vault1k-.png';
                }}
              />
              {/* Secret: click the gold V mark 3× → FleetVu Ops login */}
              <button
                type="button"
                aria-label="Staff access"
                onClick={onSecretLogoClick}
                className="absolute inset-0 m-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full focus:outline-none cursor-default"
                style={{ opacity: 0.01 }}
              />
            </div>
            <p className="mt-2 text-[10px] sm:text-xs text-amber-300/70 font-semibold tracking-[0.22em] uppercase">
              Forensic Telemetry &amp; Risk Intelligence
            </p>
            <p className="text-slate-200/80 text-xs mt-1.5">
              Select your access portal to continue.
            </p>
          </div>

          <div
            className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 transition-all duration-700 delay-100 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* Driver / Vault */}
            <div
              onMouseEnter={() => setHovered('driver')}
              onMouseLeave={() => setHovered(null)}
              className={`group relative overflow-hidden rounded-xl border p-4 sm:p-5 text-left transition-all duration-300 backdrop-blur-xl ${
                hovered === 'driver'
                  ? 'border-amber-500/50 bg-amber-950/45 shadow-xl shadow-amber-500/15'
                  : 'border-white/15 bg-black/45 hover:border-amber-500/30'
              }`}
            >
              <div className="absolute -right-3 -bottom-3 opacity-[0.07] pointer-events-none">
                <Fingerprint className="w-28 h-28 text-amber-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      hovered === 'driver'
                        ? 'bg-gradient-to-br from-amber-500 to-amber-700'
                        : 'bg-white/10 border border-white/15'
                    }`}
                  >
                    <Fingerprint className={`w-5 h-5 ${hovered === 'driver' ? 'text-white' : 'text-amber-300'}`} />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">Driver / Vault Portal</div>
                    <div className="text-[10px] text-slate-400">Field drivers &amp; dash tablets</div>
                  </div>
                </div>
                <p className="text-xs text-slate-300/90 leading-relaxed mb-3">
                  Forensic Vault with disposable keycode. Biometric binding. Zero-trust onboarding.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] mb-3">
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">Burn-on-Use Keycode</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">Biometric Lock</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => go('driver')}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${hovered === 'driver' ? 'text-amber-400' : 'text-slate-300'} hover:text-amber-300`}
                  >
                    Enter Vault Portal <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go('driver', true)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
                  >
                    Open Demo Vault (UX Review)
                  </button>
                </div>
              </div>
            </div>

            {/* Enterprise */}
            <div
              onMouseEnter={() => setHovered('enterprise')}
              onMouseLeave={() => setHovered(null)}
              className={`group relative overflow-hidden rounded-xl border p-4 sm:p-5 text-left transition-all duration-300 backdrop-blur-xl ${
                hovered === 'enterprise'
                  ? 'border-blue-400/50 bg-blue-950/45 shadow-xl shadow-blue-500/15'
                  : 'border-white/15 bg-black/45 hover:border-blue-400/30'
              }`}
            >
              <div className="absolute -right-3 -bottom-3 opacity-[0.07] pointer-events-none">
                <Building2 className="w-28 h-28 text-blue-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      hovered === 'enterprise'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                        : 'bg-white/10 border border-white/15'
                    }`}
                  >
                    <Building2 className={`w-5 h-5 ${hovered === 'enterprise' ? 'text-white' : 'text-blue-300'}`} />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">Enterprise / Admin Portal</div>
                    <div className="text-[10px] text-slate-400">Customer managers &amp; executives</div>
                  </div>
                </div>
                <p className="text-xs text-slate-300/90 leading-relaxed mb-3">
                  Corporate login for fleet managers, safety directors, and company Super Admins. MFA-protected.
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] mb-3">
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">MFA Required</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">Role-Based Access</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => go('enterprise')}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${hovered === 'enterprise' ? 'text-blue-400' : 'text-slate-300'} hover:text-blue-300`}
                  >
                    Enter Enterprise Portal <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go('enterprise', true)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-[11px] font-bold text-blue-300 hover:bg-blue-500/20"
                  >
                    Open Demo Company Dashboard (UX Review)
                  </button>
                </div>
              </div>
            </div>

            {/* AccuVu — replaces FleetVu Ops on the public gateway */}
            <div
              onMouseEnter={() => setHovered('accuvu')}
              onMouseLeave={() => setHovered(null)}
              className={`group relative overflow-hidden rounded-xl border p-4 sm:p-5 text-left transition-all duration-300 backdrop-blur-xl sm:col-span-2 lg:col-span-1 ${
                hovered === 'accuvu'
                  ? 'border-emerald-400/50 bg-emerald-950/45 shadow-xl shadow-emerald-500/15'
                  : 'border-white/15 bg-black/45 hover:border-emerald-400/30'
              }`}
            >
              <div className="absolute -right-3 -bottom-3 opacity-[0.07] pointer-events-none">
                <Gauge className="w-28 h-28 text-emerald-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      hovered === 'accuvu'
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-700'
                        : 'bg-white/10 border border-white/15'
                    }`}
                  >
                    <Gauge className={`w-5 h-5 ${hovered === 'accuvu' ? 'text-white' : 'text-emerald-300'}`} />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">AccuVu</div>
                    <div className="text-[10px] text-slate-400">Precision forensic reconstruction</div>
                  </div>
                </div>
                <p className="text-xs text-slate-300/90 leading-relaxed mb-3">
                  Accident reconstruction platform — collision spine, 77GHz playback, SHA-256 sealed digests. Secure company account for safety &amp; claims (not the full Driver Vault).
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] mb-3">
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">Reconstruction</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-slate-300">SHA-256 Digest</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => go('accuvu')}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${hovered === 'accuvu' ? 'text-emerald-300' : 'text-slate-300'} hover:text-emerald-200`}
                  >
                    Enter AccuVu Portal <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go('accuvu', true)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Open Demo AccuVu (UX Review)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mt-4 text-[10px] text-slate-300/60 shrink-0">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> SHA-256 Vault</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Zero-Trust WORM</span>
            <span className="flex items-center gap-1"><Radar className="w-3 h-3" /> Court-Admissible Custody</span>
          </div>
        </div>
      </div>

      {doorOpen && (
        <div
          className="absolute inset-0 bg-white z-50 pointer-events-none"
          style={{ animation: 'fadeInOut 220ms ease-out forwards' }}
        />
      )}
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0 }
          40% { opacity: 0.55 }
          100% { opacity: 0 }
        }
      `}</style>
    </div>
  );
}
