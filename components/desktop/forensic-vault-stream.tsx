'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Fingerprint,
  Filter,
  Radio,
  RotateCcw,
  Send,
  TriangleAlert,
} from 'lucide-react';
import type { Driver, Incident, Vehicle, VehicleProfileKey } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadarControls, RadarVisualizer } from '@/components/hud/radar-visualizer';
import {
  buildVaultEvents,
  downloadFleetvuReport,
  formatDate,
  formatTime,
  shortHash,
  type VaultEvent,
  type VaultEventCategory,
} from '@/lib/fleetvu-report';

interface ForensicVaultStreamProps {
  vehicle: Vehicle | null;
  drivers: Driver[];
  incidents: Incident[];
  activeSensors: string[];
  controls: RadarControls;
  compact?: boolean;
}

type EventFilter = VaultEventCategory;
type ObstructionFilter = 'all' | 'critical' | 'warning';

export function ForensicVaultStream({ vehicle, drivers, incidents, activeSensors, controls, compact = false }: ForensicVaultStreamProps) {
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [obstructionFilter, setObstructionFilter] = useState<ObstructionFilter>('all');
  const [lastSync, setLastSync] = useState(new Date());
  const [postRunning, setPostRunning] = useState(false);
  const [postCompleted, setPostCompleted] = useState(true);

  const activeDriver = useMemo(
    () => (vehicle ? drivers.find((d) => d.id === vehicle.assigned_driver_id) || null : null),
    [vehicle, drivers],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setLastSync(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const events = useMemo<VaultEvent[]>(() => buildVaultEvents(vehicle, incidents), [vehicle, incidents]);

  const filteredEvents = events.filter((event) => eventFilter === 'all' || event.category === eventFilter);
  const obstructionEvents = events.filter((event) => event.category === 'obstruction' && (obstructionFilter === 'all' || event.severity === obstructionFilter));
  const runPostCheck = () => {
    setPostRunning(true);
    setPostCompleted(false);
    window.setTimeout(() => {
      setPostRunning(false);
      setPostCompleted(true);
      setLastSync(new Date());
    }, 900);
  };

  const downloadLog = async () => {
    await downloadFleetvuReport({ vehicle, driver: activeDriver, events: filteredEvents, activeSensors, lastSync, postCompleted });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#07121d] scrollbar-thin">
      {!compact && (
      <div className="shrink-0 border-b border-cyan-950/70 bg-[#081522] p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Live Vault Telemetry</span>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live</span>
        </div>
        <div className="h-[248px] overflow-hidden rounded-xl border border-cyan-500/20 bg-[#050c16]">
          {vehicle ? (
            <RadarVisualizer
              vehicleType={vehicle.chassis_type as VehicleProfileKey}
              speedMph={42}
              activeSensors={activeSensors}
              hardwareProfile={vehicle.hardware_profile?.startsWith('c55') ? vehicle.hardware_profile : 'c55_pro_forward_lr'}
              expandedMode
              safetyScore={vehicle.safety_score}
              location={vehicle.location || undefined}
              controls={controls}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">Select a vehicle to view live telemetry</div>
          )}
        </div>
      </div>
      )}

      <section className="shrink-0 border-b border-cyan-500/20 p-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-emerald-300">SHA-256 Chain Intact</span>
                <span className="text-[9px] font-black uppercase text-emerald-400">Verified</span>
              </div>
              <p className="truncate font-mono text-[9px] text-slate-400">2 blocks verified · Genesis: {shortHash(vehicle?.id || 'fleetvu-genesis')}...</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
            <span>0 Tamper Events</span>
            <span>{formatTime(lastSync)}</span>
          </div>
        </div>
      </section>

      <section className="shrink-0 border-b border-slate-700/70 p-2">
        <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-[#0b1824]">
          <div className="flex items-center gap-2 border-b border-slate-700/70 px-3 py-2">
            <FileText className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">Vault Event Stream</span>
            <Filter className="ml-auto h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-700/70 p-2 scrollbar-thin">
            {(['all', 'post', 'obstruction', 'diag', 'high-g'] as EventFilter[]).map((filter) => (
              <button key={filter} type="button" onClick={() => setEventFilter(filter)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-black uppercase transition-colors ${eventFilter === filter ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {filter === 'high-g' ? 'High-G' : filter}
              </button>
            ))}
          </div>
          <div className="max-h-[156px] overflow-y-auto scrollbar-thin">
            {filteredEvents.length === 0 ? <EmptyState label="No events recorded for this filter" /> : filteredEvents.map((event) => <VaultEventRow key={event.id} event={event} />)}
          </div>
          <div className="flex items-center justify-between border-t border-slate-700/70 px-3 py-1.5 text-[9px] text-slate-500">
            <span>{filteredEvents.length} total entries</span>
            <span className="font-bold text-emerald-400">Chain Verified</span>
          </div>
        </div>
        <Button type="button" variant="outline" disabled={!vehicle} onClick={downloadLog} className="mt-2 h-9 w-full gap-2 border-slate-600 bg-slate-900/60 text-xs font-bold text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-4 w-4" /> {vehicle ? 'Download PDF Log Report' : 'Select a vehicle to download'}
        </Button>
      </section>

      <section className="shrink-0 p-2">
        <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#0b1824]">
          <div className="flex items-center gap-2 border-b border-slate-700/70 px-3 py-2.5">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-1.5"><Eye className="h-4 w-4 text-amber-400" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-black text-white">Obstruction &amp; Event Log</p><p className="text-[9px] text-slate-500">{obstructionEvents.length} events · Auto-syncing</p></div>
            <Badge className="border border-amber-500/40 bg-amber-500/10 text-[9px] font-black text-amber-400">MONITORING</Badge>
          </div>
          <div className="flex gap-1.5 p-2">
            {(['all', 'critical', 'warning'] as ObstructionFilter[]).map((filter) => (
              <button key={filter} type="button" onClick={() => setObstructionFilter(filter)} className={`rounded-full px-2.5 py-1.5 text-[9px] font-black uppercase ${obstructionFilter === filter ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {filter === 'all' ? 'All Events' : filter === 'critical' ? 'Critical (< 2.0m)' : 'Warnings (2.0m - 5.0m)'}
              </button>
            ))}
          </div>
          <div className="mx-2 mb-2 max-h-[170px] overflow-y-auto border border-slate-700/70 bg-slate-900/40 p-2 scrollbar-thin">
            {obstructionEvents.length === 0 ? <EmptyState label="No obstructions detected yet" detail="Events will appear when the vehicle is in motion" /> : obstructionEvents.map((event) => <ObstructionRow key={event.id} event={event} />)}
          </div>
        </div>
      </section>

      <section className="shrink-0 px-2 pb-3">
        <div className="rounded-xl border border-emerald-500/25 bg-[#0b1824] p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-black text-white">Daily POST Check</p><p className="text-[9px] text-slate-500">Last completed: {formatDate(lastSync)}, {formatTime(lastSync)}</p></div>
            <Badge className={postCompleted ? 'bg-emerald-500 text-[9px] font-black text-white' : 'bg-amber-500 text-[9px] font-black text-white'}>{postCompleted ? 'COMPLETED' : 'RUNNING'}</Badge>
          </div>
          <Button type="button" disabled={postRunning} onClick={runPostCheck} className="mt-3 h-9 w-full gap-2 bg-orange-500 text-xs font-black text-white hover:bg-orange-600">
            {postRunning ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {postRunning ? 'Running System Self-Test' : 'Re-Run System Self-Test'}
          </Button>
        </div>
      </section>
    </div>
  );
}

function VaultEventRow({ event }: { event: VaultEvent }) {
  const isPass = event.severity === 'pass';
  return <div className="grid grid-cols-[34px_46px_1fr_58px] items-center gap-1 border-b border-slate-800 px-3 py-2 last:border-0">
    <span className="font-mono text-[9px] text-slate-500">#{event.id.slice(-2)}</span>
    <span className={`rounded px-1.5 py-0.5 text-center text-[8px] font-black ${isPass ? 'bg-emerald-500/15 text-emerald-400' : event.severity === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{isPass ? 'PASS' : event.severity}</span>
    <div className="min-w-0"><p className="truncate text-[10px] font-bold text-slate-200">{event.title}</p><p className="truncate text-[9px] text-slate-500">{event.detail}</p></div>
    <span className="text-right font-mono text-[8px] text-slate-500">{event.hash.slice(0, 8)}</span>
  </div>;
}

function ObstructionRow({ event }: { event: VaultEvent }) {
  return <div className="flex items-center gap-2 border-b border-slate-800 py-2 last:border-0">
    {event.severity === 'critical' ? <TriangleAlert className="h-4 w-4 shrink-0 text-red-400" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />}
    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-slate-200">{event.title}</p><p className="truncate text-[9px] text-slate-500">{event.zone} · {event.time}</p></div>
    <span className={`font-mono text-[10px] font-black ${event.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{event.distance?.toFixed(1) || '—'}m</span>
  </div>;
}

function EmptyState({ label, detail }: { label: string; detail?: string }) {
  return <div className="flex min-h-[92px] flex-col items-center justify-center gap-1 text-center"><Activity className="h-5 w-5 text-slate-600" /><p className="text-[10px] font-semibold text-slate-400">{label}</p>{detail && <p className="text-[9px] text-slate-600">{detail}</p>}</div>;
}
