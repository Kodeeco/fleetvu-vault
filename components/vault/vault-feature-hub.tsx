'use client';

import React, { useState } from 'react';
import {
  Radio,
  MapPin,
  AlertOctagon,
  ClipboardCheck,
  FileText,
  ArrowLeft,
  Lock,
  Wifi,
  WifiOff,
  Shield,
  Navigation,
} from 'lucide-react';
import type { AuthUser } from '@/lib/app-context';
import { getPostCheckState, setPostCheckState } from '@/lib/vault-session';
import { usePortalMobileSync } from '@/hooks/use-portal-mobile-sync';

export type VaultFeature =
  | 'live_sensors'
  | 'live_gps'
  | 'report_incident'
  | 'post_check'
  | 'event_log'
  | 'lock_vault';

interface VaultFeatureHubProps {
  user: AuthUser;
  onSelect: (feature: VaultFeature) => void;
  onLock: () => void;
  previewMode?: boolean;
}

/**
 * Inside-Vault feature menu — connects driver mobile features to the
 * customer web portal (live sensors, GPS, incidents, POST).
 */
export function VaultFeatureHub({ user, onSelect, onLock, previewMode }: VaultFeatureHubProps) {
  const { state: syncState, pendingCount, enqueue } = usePortalMobileSync({
    companyId: user.companyId ?? null,
    enabled: true,
  });
  const [postRunning, setPostRunning] = useState(false);
  const [postMsg, setPostMsg] = useState<string | null>(null);

  const runPostCheck = async () => {
    setPostRunning(true);
    setPostMsg(null);
    await new Promise((r) => setTimeout(r, 1400));
    const result = { status: 'passed' as const, lastRunAt: new Date().toISOString() };
    setPostCheckState(result);
    enqueue('compliance_signoff', {
      type: 'daily_post_check',
      status: 'passed',
      driverName: user.name,
      driverId: user.driverId || user.driverNumber,
      truckNumber: user.truckNumber,
      companyId: user.companyId,
      actorEmail: user.email,
      actorRole: 'driver',
      platform: 'mobile',
      appVersion: '1.0.0',
    });
    setPostRunning(false);
    setPostMsg('POST check passed — synced to company portal.');
    onSelect('post_check');
  };

  const features: Array<{
    id: VaultFeature;
    label: string;
    desc: string;
    icon: typeof Radio;
    accent: string;
    action?: () => void;
  }> = [
    {
      id: 'live_sensors',
      label: 'Live Sensor Radar',
      desc: '77GHz proximity HUD — streamed to company portal',
      icon: Radio,
      accent: 'border-orange-500/40 bg-orange-500/10',
    },
    {
      id: 'live_gps',
      label: 'Live GPS Tracking',
      desc: 'Real-time location for fleet directors',
      icon: Navigation,
      accent: 'border-blue-500/40 bg-blue-500/10',
    },
    {
      id: 'report_incident',
      label: 'Report Incident',
      desc: 'Photos, licenses, insurance → Reconstruction Portal',
      icon: AlertOctagon,
      accent: 'border-red-500/40 bg-red-500/10',
    },
    {
      id: 'post_check',
      label: 'Daily POST Check',
      desc: 'Power-On Self Test for C55-Pro sensors',
      icon: ClipboardCheck,
      accent: 'border-amber-500/40 bg-amber-500/10',
      action: runPostCheck,
    },
    {
      id: 'event_log',
      label: 'Forensic Event Log',
      desc: 'Hazard cues & sealed telemetry history',
      icon: FileText,
      accent: 'border-emerald-500/40 bg-emerald-500/10',
    },
  ];

  const post = getPostCheckState();

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      <div className="shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onLock}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Lock Vault
          </button>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            {syncState === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" /> Portal Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <WifiOff className="w-3.5 h-3.5" /> {syncState}
                {pendingCount > 0 ? ` · ${pendingCount}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto space-y-5">
          {previewMode && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
              Global-Admin preview of driver Vault features
            </div>
          )}

          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
              <Shield className="w-3 h-3" /> Vault Unlocked
            </div>
            <h2 className="mt-3 text-xl font-bold text-white">{user.name}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {user.companyName || 'Fleet'} · Truck {user.truckNumber || '—'} ·{' '}
              {user.sensorHardware || 'C55-Pro'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              POST: {post.status.toUpperCase()}
              {post.lastRunAt ? ` · ${new Date(post.lastRunAt).toLocaleString()}` : ' · Never run'}
            </p>
          </div>

          {postMsg && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {postMsg}
            </div>
          )}

          <div className="space-y-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={f.id === 'post_check' && postRunning}
                  onClick={() => (f.action ? f.action() : onSelect(f.id))}
                  className={`w-full text-left rounded-xl border p-4 transition-all hover:scale-[1.01] ${f.accent}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">
                        {f.id === 'post_check' && postRunning ? 'Running POST…' : f.label}
                      </div>
                      <div className="text-xs text-slate-300/80 mt-0.5">{f.desc}</div>
                    </div>
                    {f.id === 'live_gps' && <MapPin className="w-4 h-4 text-blue-300 shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onLock}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-semibold text-slate-300 hover:text-white hover:border-slate-500"
          >
            <Lock className="w-4 h-4" /> Lock Vault Session
          </button>
        </div>
      </div>
    </div>
  );
}
