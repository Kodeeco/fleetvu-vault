'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Syne, JetBrains_Mono } from 'next/font/google';
import {
  Play,
  Pause,
  ShieldCheck,
  Radio,
  Hash,
  Gauge,
  Crosshair,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { ReconstructionCanvas } from '@/components/reconstruction/reconstruction-canvas';
import { Button } from '@/components/ui/button';

const syne = Syne({ subsets: ['latin'], weight: ['600', '700', '800'] });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'] });

/** Signature demo window: T−3.0s → impact → T+2.0s */
const T_MIN = -3;
const T_MAX = 2;
const PLAYBACK_MS = 9000;

const DIGEST_SEED =
  'a7f3c91e2b84d056e1c48a90f3b27d6e5c41a8f029e7b3d14c6a5f82e901b4d7';

interface AccuVuHeroLandProps {
  onEnterWorkspace: () => void;
}

export function AccuVuHeroLand({ onEnterWorkspace }: AccuVuHeroLandProps) {
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(T_MIN);
  const [mounted, setMounted] = useState(false);
  const [sealed, setSealed] = useState(false);
  const rafRef = useRef<number>(0);
  const tAnchorRef = useRef(T_MIN);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const origin = performance.now() - ((tAnchorRef.current - T_MIN) / (T_MAX - T_MIN)) * PLAYBACK_MS;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = (now - origin) % PLAYBACK_MS;
      const next = T_MIN + (elapsed / PLAYBACK_MS) * (T_MAX - T_MIN);
      tAnchorRef.current = next;
      setT(next);
      setSealed(next >= -0.05);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const phase = useMemo<'pre' | 'impact' | 'post'>(() => {
    if (t < -0.15) return 'pre';
    if (t <= 0.35) return 'impact';
    return 'post';
  }, [t]);

  const truckSpeed = useMemo(() => {
    if (t < 0) return 42 + t * 1.2;
    if (t < 0.8) return Math.max(8, 42 - t * 38);
    return Math.max(4, 12 - (t - 0.8) * 4);
  }, [t]);

  const impactDistance = useMemo(() => {
    if (t < 0) return Math.max(0.4, 18 + t * 5.5);
    return Math.max(0.2, 0.4 + t * 1.1);
  }, [t]);

  const digestLive = useMemo(() => {
    const progress = Math.min(1, Math.max(0, (t - T_MIN) / (0 - T_MIN)));
    const chars = Math.floor(16 + progress * (DIGEST_SEED.length - 16));
    return DIGEST_SEED.slice(0, chars);
  }, [t]);

  const progressPct = ((t - T_MIN) / (T_MAX - T_MIN)) * 100;

  const scrub = useCallback((value: number) => {
    setPlaying(false);
    tAnchorRef.current = value;
    setT(value);
    setSealed(value >= -0.05);
  }, []);

  return (
    <div
      className={`relative flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950 text-slate-100 ${syne.className}`}
    >
      {/* Atmospheric depth — workspace blue, not green */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_75%,rgba(30,64,175,0.18),transparent_50%)]" />

      {/* Brand strip */}
      <header
        className={`relative z-20 shrink-0 px-5 sm:px-8 pt-3 pb-2 flex items-end justify-between gap-4 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
        }`}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 shadow-[0_0_28px_rgba(56,189,248,0.35)]">
              <Gauge className="h-6 w-6 text-white" />
              <span className="absolute inset-0 rounded-xl ring-1 ring-sky-300/40 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-none">
                AccuVu
              </h1>
              <p className="mt-1 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
                Accident Reconstruction
              </p>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 leading-snug">
            This is your product home — a live demo of how AccuVu reconstructs a crash second-by-second.
            Watch it play, then open the workspace to work real cases.
          </p>
        </div>

        <div className={`hidden sm:flex flex-col items-end gap-1.5 ${mono.className}`}>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              sealed
                ? 'border-sky-400/50 bg-sky-500/15 text-sky-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            {sealed ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {sealed ? 'SHA-256 Sealed' : 'Sealing at Impact…'}
          </div>
          <span className="text-[10px] text-slate-500">Signature demo · Case AV-2026-TRK102</span>
        </div>
      </header>

      {/* Dominant reconstruction stage */}
      <div
        className={`relative z-10 flex-1 min-h-0 mx-3 sm:mx-6 mb-2 rounded-2xl overflow-hidden border border-sky-500/20 shadow-[0_0_50px_rgba(56,189,248,0.08)] bg-slate-900 transition-all duration-1000 delay-100 ${
          mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        }`}
      >
        {/* Radar sweep overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-[5] opacity-35 mix-blend-screen"
          style={{
            background: `conic-gradient(from ${((t - T_MIN) / (T_MAX - T_MIN)) * 360}deg at 42% 50%, transparent 0deg, rgba(56,189,248,0.32) 28deg, transparent 70deg)`,
          }}
        />

        <ReconstructionCanvas
          truckSpeed={truckSpeed}
          targetSpeed={0}
          approachAngle="0°"
          impactDistance={impactDistance}
          latitude={39.0997}
          longitude={-94.5786}
          timestamp={new Date(Date.UTC(2026, 8, 28, 14, 22, Math.max(0, Math.floor(22 + t)))).toISOString()}
          laneSelection="center"
          impactAngleType="inline_rear"
          fleetTruckMotion="moving"
          targetVehicleMotion="stopped"
          phase={phase}
          wideField
          theme="accuvu"
          showChrome={false}
          className="absolute inset-0 w-full h-full"
        />

        {/* Live HUD — top-right, clear of the scene */}
        <div
          className={`absolute top-3 right-3 z-10 flex flex-wrap justify-end gap-1.5 max-w-[min(100%,280px)] ${mono.className} transition-opacity duration-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <HudChip icon={<Radio className="h-3.5 w-3.5 text-sky-400" />} label="77GHz" value="C55-PRO" />
          <HudChip icon={<Gauge className="h-3.5 w-3.5 text-sky-400" />} label="Tractor" value={`${truckSpeed.toFixed(1)} MPH`} />
          <HudChip icon={<Crosshair className="h-3.5 w-3.5 text-sky-400" />} label="Closing" value={`${impactDistance.toFixed(1)} m`} />
          <HudChip
            icon={<Hash className="h-3.5 w-3.5 text-sky-400" />}
            label="Phase"
            value={phase === 'pre' ? 'PRE' : phase === 'impact' ? 'IMPACT' : 'POST'}
            accent={phase === 'impact'}
          />
        </div>

        {/* Digest strip */}
        <div className={`absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent px-4 pt-12 pb-3 ${mono.className}`}>
          <div className="flex items-center gap-2 text-[10px] text-sky-400/80 uppercase tracking-widest font-bold mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Chain-of-custody digest
          </div>
          <p className="text-[11px] sm:text-xs text-sky-100/85 font-medium break-all leading-relaxed">
            sha256:{digestLive}
            <span className={sealed ? 'opacity-0' : 'animate-pulse text-sky-400'}>▍</span>
          </p>
        </div>

        {phase === 'impact' && (
          <div className="pointer-events-none absolute inset-0 z-[6] bg-sky-400/10 animate-pulse" />
        )}
      </div>

      {/* Timeline + CTAs */}
      <div
        className={`relative z-20 shrink-0 px-5 sm:px-8 pb-4 pt-1 transition-all duration-700 delay-200 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)] hover:bg-sky-400 transition-colors"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <div className={`relative flex-1 ${mono.className}`}>
            <div className="flex justify-between text-[10px] text-slate-500 font-medium mb-1">
              <span>T{T_MIN.toFixed(1)}s</span>
              <span className={phase === 'impact' ? 'text-sky-300 font-bold' : 'text-slate-400'}>
                IMPACT @ T0.0s
              </span>
              <span>T+{T_MAX.toFixed(1)}s</span>
            </div>
            <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-700 via-sky-400 to-cyan-300"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
                style={{ left: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={T_MIN}
              max={T_MAX}
              step={0.01}
              value={t}
              onChange={(e) => scrub(Number(e.target.value))}
              className="absolute inset-x-0 top-4 h-6 opacity-0 cursor-pointer"
              aria-label="Scrub reconstruction timeline"
            />
          </div>
          <div className={`w-16 text-right ${mono.className}`}>
            <span className={`text-sm font-bold ${phase === 'impact' ? 'text-sky-300' : 'text-white'}`}>
              {t >= 0 ? `+${t.toFixed(2)}` : t.toFixed(2)}s
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Button
            className="h-11 px-5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-[0_0_28px_rgba(56,189,248,0.3)]"
            onClick={onEnterWorkspace}
          >
            Enter Case Workspace
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-slate-500 max-w-lg">
            Home screen = product showcase (auto-play). Workspace = where you open cases, digests, and seals.
          </p>
        </div>
      </div>
    </div>
  );
}

function HudChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 backdrop-blur-md ${
        accent
          ? 'border-sky-400/50 bg-sky-500/20'
          : 'border-white/10 bg-slate-950/70'
      }`}
    >
      {icon}
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
        <div className={`text-[11px] font-bold ${accent ? 'text-sky-200' : 'text-white'}`}>{value}</div>
      </div>
    </div>
  );
}
