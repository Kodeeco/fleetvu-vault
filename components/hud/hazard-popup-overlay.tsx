'use client';

import React, { useEffect, useState } from 'react';
import { Bike, Car, PersonStanding, Truck, AlertTriangle, MapPin } from 'lucide-react';
import {
  type HazardDetection,
  type HazardType,
  hazardColor,
  hazardIconLabel,
  isHazardExpired,
} from '@/lib/hazard-detection';
import { cn } from '@/lib/utils';

/**
 * HTML hazard popups over the canvas radar (5s then expire → event log).
 * Company portal receives the same cue via portal↔mobile sync.
 */
export function HazardPopupOverlay({
  hazards,
  onExpire,
}: {
  hazards: HazardDetection[];
  onExpire: (id: string) => void;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      const now = Date.now();
      hazards.forEach((h) => {
        if (isHazardExpired(h, now)) onExpire(h.id);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [hazards, onExpire]);

  if (!hazards.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {hazards.map((h) => {
        const now = Date.now();
        const remaining = new Date(h.expiresAt).getTime() - now;
        const progress = Math.max(0, Math.min(1, remaining / 5000));
        const opacity = progress < 0.2 ? progress / 0.2 : 1;
        const color = hazardColor(h.type);
        const pos = zonePosition(h.zone, h.distanceM);
        const detected = new Date(h.detectedAt);

        return (
          <div
            key={h.id}
            className="absolute flex flex-col items-center"
            style={{
              left: pos.left,
              top: pos.top,
              transform: 'translate(-50%, -50%)',
              opacity,
              transition: 'opacity 0.25s ease-out',
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-2 ring-white/30 animate-pulse"
              style={{ backgroundColor: color }}
            >
              <HazardGlyph type={h.type} />
            </div>
            <div
              className="mt-1 rounded-md border bg-slate-950/95 px-2 py-1 text-center shadow-xl min-w-[120px]"
              style={{ borderColor: color }}
            >
              <p className="text-[10px] font-black uppercase" style={{ color }}>
                {hazardIconLabel(h.type)}
              </p>
              <p className="text-[9px] font-bold text-white">
                {h.zone.toUpperCase()} · {h.distanceM.toFixed(1)}m
              </p>
              <p className="text-[8px] text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {detected.toLocaleTimeString([], { hour12: false })}
                {h.latitude != null && h.longitude != null
                  ? ` · ${h.latitude.toFixed(3)}, ${h.longitude.toFixed(3)}`
                  : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function zonePosition(zone: HazardDetection['zone'], distanceM: number): { left: string; top: string } {
  // Place in the forward/left/right radar field (above truck bumper)
  const depth = Math.min(0.55, 0.22 + distanceM * 0.05);
  if (zone === 'left') return { left: '28%', top: `${28 + depth * 20}%` };
  if (zone === 'right') return { left: '72%', top: `${28 + depth * 20}%` };
  return { left: '50%', top: `${18 + depth * 25}%` };
}

function HazardGlyph({ type }: { type: HazardType }) {
  const cls = 'w-5 h-5 text-white';
  switch (type) {
    case 'pedestrian':
      return <PersonStanding className={cls} />;
    case 'cyclist':
      return <Bike className={cls} />;
    case 'small_car':
      return <Car className={cls} />;
    case 'vehicle':
      return <Truck className={cls} />;
    default:
      return <AlertTriangle className={cls} />;
  }
}

/** RED / YELLOW / GREEN proximity flags — compact strip under the radar */
export function ProximityFlagBar({
  zone,
  distanceM,
}: {
  zone: 'green' | 'yellow' | 'red' | null;
  distanceM: number;
}) {
  const flags: Array<{ id: 'red' | 'yellow' | 'green'; label: string; short: string; bg: string; text: string }> = [
    { id: 'red', label: 'CRITICAL', short: 'RED', bg: 'bg-red-500', text: 'text-red-300' },
    { id: 'yellow', label: 'CAUTION', short: 'YEL', bg: 'bg-amber-400', text: 'text-amber-300' },
    { id: 'green', label: 'CLEAR', short: 'GRN', bg: 'bg-emerald-500', text: 'text-emerald-300' },
  ];

  return (
    <div className="mx-2.5 mt-1 flex items-center gap-1 rounded-md border border-slate-800 bg-[#0a1018]/90 px-1 py-0.5">
      {flags.map((f) => {
        const active = zone === f.id;
        return (
          <div
            key={f.id}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-[3px] transition-all',
              active
                ? `${f.bg} text-slate-950 shadow-sm`
                : 'bg-transparent text-slate-600',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                active ? 'bg-slate-950/80' : f.id === 'red' ? 'bg-red-500/50' : f.id === 'yellow' ? 'bg-amber-400/50' : 'bg-emerald-500/50',
              )}
            />
            <span className={cn('text-[8px] font-black tracking-wider uppercase', !active && f.text)}>
              {active ? f.label : f.short}
            </span>
            {active && (
              <span className="text-[8px] font-bold tabular-nums opacity-90">{distanceM.toFixed(1)}m</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
