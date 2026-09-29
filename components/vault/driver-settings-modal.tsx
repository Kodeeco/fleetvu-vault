'use client';

import React, { useEffect, useState } from 'react';
import {
  Moon,
  Settings2,
  Signal,
  Sun,
  Volume2,
  VolumeX,
  X,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

export interface DriverSettingsState {
  alertVolumeOn: boolean;
  alertVolume: number;
  nightMode: boolean;
  brightness: number;
}

interface DriverSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: DriverSettingsState;
  onChange: (next: DriverSettingsState) => void;
  sensorSerial?: string;
  sensorPairedLabel?: string;
}

/**
 * Bolt Driver Settings — audio, night display, read-only sensor pairing.
 */
export function DriverSettingsModal({
  open,
  onClose,
  settings,
  onChange,
  sensorSerial = 'FV-ELITE-67F2',
  sensorPairedLabel = 'Sep 28',
}: DriverSettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1219] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-sm font-black text-white">Driver Settings</p>
              <p className="text-[10px] text-slate-500">Audio, display, and sensor status</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* Alert Volume */}
          <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Alert Volume</p>
                  <p className="text-[10px] text-slate-500">In-cab buzzer chimes</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-orange-400">{settings.alertVolumeOn ? 'ON' : 'OFF'}</span>
                <Switch
                  checked={settings.alertVolumeOn}
                  onCheckedChange={(v) => onChange({ ...settings, alertVolumeOn: v })}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              <Slider
                value={[settings.alertVolume]}
                min={0}
                max={100}
                step={1}
                disabled={!settings.alertVolumeOn}
                onValueChange={([v]) => onChange({ ...settings, alertVolume: v })}
                className="flex-1"
              />
              <Volume2 className="w-3.5 h-3.5 text-orange-400" />
              <span className="w-9 text-right font-mono text-[11px] font-bold text-orange-300">{settings.alertVolume}%</span>
            </div>
          </section>

          {/* Display Mode */}
          <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Display Mode</p>
                  <p className="text-[10px] text-slate-500">Reduce glare for day or night driving</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-300">{settings.nightMode ? 'NIGHT' : 'DAY'}</span>
                <Switch
                  checked={settings.nightMode}
                  onCheckedChange={(v) => onChange({ ...settings, nightMode: v })}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-slate-500" />
              <Slider
                value={[settings.brightness]}
                min={20}
                max={100}
                step={1}
                onValueChange={([v]) => onChange({ ...settings, brightness: v })}
                className="flex-1"
              />
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </section>

          {/* Sensor Status — read-only */}
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <div className="flex items-start gap-2.5 mb-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Radio className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">FleetVu Elite Front Bumper Radar</p>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Connected</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
              <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 px-2.5 py-2">
                <p className="text-slate-500 uppercase tracking-wide">Serial</p>
                <p className="font-mono text-slate-200 mt-0.5">{sensorSerial}</p>
              </div>
              <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 px-2.5 py-2">
                <p className="text-slate-500 uppercase tracking-wide">Paired</p>
                <p className="font-mono text-slate-200 mt-0.5">{sensorPairedLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Signal className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full w-[88%] rounded-full bg-emerald-500" />
              </div>
              <span className="text-[9px] font-semibold text-emerald-300">-42 dBm · Excellent</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">Active sensor array · 8 sensors</p>
            <p className="text-[9px] text-slate-600 leading-relaxed">
              Sensor pairing is managed by your fleet administrator. Contact support to modify device connections.
            </p>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-slate-800">
          <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
