'use client';

import React, { useEffect, useRef } from 'react';
import { AlertOctagon, Car, CheckCircle2, Clock, Gauge, MapPin, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ImpactAlertData {
  joltG: number;
  speedMph: number;
  latitude: number | null;
  longitude: number | null;
  reason: string;
  timestamp: string;
}

interface ImpactAlertOverlayProps {
  alert: ImpactAlertData;
  onReportIncident: () => void;
  onImOk: () => void;
  onDismiss?: () => void;
}

/**
 * Shock / collision page — full-screen on G-force event.
 * Driver cannot adjust sensors here — ranges are company-admin only.
 */
export function ImpactAlertOverlay({
  alert,
  onReportIncident,
  onImOk,
}: ImpactAlertOverlayProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    let cancelled = false;

    const playBeepLoop = async () => {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;

        const chirp = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
          osc.start(start);
          osc.stop(start + dur);
        };

        while (!cancelled && !stopRef.current) {
          const t0 = ctx.currentTime;
          chirp(880, t0, 0.12);
          chirp(880, t0 + 0.2, 0.12);
          chirp(1100, t0 + 0.4, 0.18);
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch {
        /* audio unavailable */
      }
    };

    void playBeepLoop();

    return () => {
      cancelled = true;
      stopRef.current = true;
      try {
        audioCtxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stopAudio = () => {
    stopRef.current = true;
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
  };

  const when = new Date(alert.timestamp);

  return (
    <div className="fixed inset-0 z-[80] bg-red-950/97 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm h-[100dvh] max-h-[740px] flex flex-col justify-center py-2">
        <div className="text-center mb-3">
          <p className="text-[10px] font-bold tracking-[0.2em] text-red-300 uppercase mb-1">
            Collision / Shock Event
          </p>
          <h2 className="text-2xl font-black text-white tracking-wide">IMPACT DETECTED</h2>
          <p className="text-sm text-red-200 mt-1.5">{alert.reason}</p>
        </div>

        {/* Collision visual — fleet truck + other vehicle */}
        <div className="relative mx-auto w-full max-w-[280px] h-[140px] mb-4 rounded-2xl border border-red-400/25 bg-black/40 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center gap-2 px-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center">
                <Truck className="w-9 h-9 text-orange-300" />
              </div>
              <span className="text-[9px] text-orange-200/80 mt-1 font-semibold">YOUR TRUCK</span>
            </div>
            <div className="flex flex-col items-center px-1">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center animate-pulse shadow-[0_0_24px_rgba(239,68,68,0.6)]">
                <AlertOctagon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[9px] text-red-200 font-black mt-1">{alert.joltG.toFixed(1)}g</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-xl bg-slate-500/20 border border-slate-400/30 flex items-center justify-center">
                <Car className="w-8 h-8 text-slate-200" />
              </div>
              <span className="text-[9px] text-slate-300/80 mt-1 font-semibold">OTHER VEHICLE</span>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Truck2.png"
            alt=""
            className="absolute bottom-0 left-3 w-20 opacity-30 pointer-events-none"
          />
        </div>

        <div className="rounded-2xl border border-red-400/30 bg-black/45 p-3.5 space-y-2 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-red-200/80 flex items-center gap-2">
              <Gauge className="w-4 h-4" /> G-Force Peak
            </span>
            <span className="font-black text-white tabular-nums">{alert.joltG.toFixed(2)} g</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-red-200/80">Speed at Impact</span>
            <span className="font-bold text-white tabular-nums">{alert.speedMph.toFixed(0)} mph</span>
          </div>
          <div className="flex items-center justify-between text-xs text-red-200/70">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Date / Time
            </span>
            <span>{when.toLocaleString()}</span>
          </div>
          {(alert.latitude != null || alert.longitude != null) && (
            <div className="flex items-center justify-between text-xs text-red-200/70">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Location
              </span>
              <span className="tabular-nums">
                {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
              </span>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-red-100/80 mb-4 leading-relaxed px-1">
          Real collision? Tap <strong>Report Incident</strong> — evidence goes only to your company.
          False positive / pothole? Tap <strong>I&apos;m OK</strong>.
        </p>

        <div className="space-y-2.5">
          <Button
            className="w-full h-14 text-base font-black bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl shadow-xl"
            onClick={() => {
              stopAudio();
              onReportIncident();
            }}
          >
            <AlertOctagon className="w-5 h-5 mr-2" />
            Report Incident
          </Button>

          <Button
            className="w-full h-14 text-base font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
            onClick={() => {
              stopAudio();
              onImOk();
            }}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            I&apos;m OK
          </Button>
        </div>
      </div>
    </div>
  );
}
