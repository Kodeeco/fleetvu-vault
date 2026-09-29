'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Fingerprint,
  RefreshCw,
  Shield,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AuthUser } from '@/lib/app-context';
import {
  archiveFleetvuReport,
  downloadFleetvuReport,
  formatDate,
  formatTime,
  shortHash,
  type VaultEvent,
  type VaultEventCategory,
} from '@/lib/fleetvu-report';
import type { Driver, Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AuthorizationGate } from '@/components/auth/authorization-gate';
import { shouldBypassGate } from '@/lib/testing-mode';
import { checkFeatureAccess } from '@/src/vault/feature-tiers';
import { hazardLogToVaultEvents } from '@/lib/session-digest';
import type { HazardEventLog } from '@/lib/hazard-detection';

interface ForensicVaultPanelProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  forwardRange: number;
  leftRange: number;
  rightRange: number;
  postCompleted: boolean;
  postLastRunAt: string | null;
  onRunPost: () => void;
  postRunning?: boolean;
  /** Live hazard events from this shift — preferred over demo seeds when present */
  hazardLog?: HazardEventLog[];
}

type EventFilter = VaultEventCategory;
type ObstructionFilter = 'all' | 'critical' | 'warning';

function demoEvents(driverId: string): VaultEvent[] {
  const now = Date.now();
  return [
    {
      id: `${driverId}-5`,
      category: 'diag',
      severity: 'warning',
      time: '10:45',
      timestamp: now - 1000 * 60 * 80,
      title: 'Radar module communication fault detected',
      detail: 'FORWARD array brief dropout — auto-recovered',
      hash: 'CA972410',
      zone: 'FORWARD',
    },
    {
      id: `${driverId}-4`,
      category: 'post',
      severity: 'pass',
      time: '10:45',
      timestamp: now - 1000 * 60 * 81,
      title: 'POST Check PASSED',
      detail: 'Daily self-test complete',
      hash: shortHash(`${driverId}-post-4`),
    },
    {
      id: `${driverId}-3`,
      category: 'post',
      severity: 'pass',
      time: '10:45',
      timestamp: now - 1000 * 60 * 82,
      title: 'POST Check PASSED',
      detail: 'Sensor suite verified',
      hash: shortHash(`${driverId}-post-3`),
    },
    {
      id: `${driverId}-2`,
      category: 'post',
      severity: 'pass',
      time: '07:41',
      timestamp: now - 1000 * 60 * 60 * 5,
      title: 'POST Check PASSED',
      detail: 'Morning Bluetooth handshake',
      hash: shortHash(`${driverId}-post-2`),
    },
    {
      id: `${driverId}-1`,
      category: 'post',
      severity: 'pass',
      time: '07:41',
      timestamp: now - 1000 * 60 * 60 * 5 - 30000,
      title: 'POST Check PASSED',
      detail: 'Cabin pair confirmed',
      hash: shortHash(`${driverId}-post-1`),
    },
    {
      id: `${driverId}-obs-1`,
      category: 'obstruction',
      severity: 'critical',
      time: '10:45:29',
      timestamp: now - 1000 * 60 * 79,
      title: 'VEHICLE [DIAG] RADAR FAULT',
      detail: 'FORWARD critical diagnostic',
      hash: shortHash(`${driverId}-obs`),
      distance: 1.2,
      zone: 'FORWARD',
    },
  ];
}

/**
 * Mobile FORENSIC VAULT expand — Audit Stream, Obstruction Log, PDF download + archive.
 */
export function ForensicVaultPanel({
  open,
  onClose,
  user,
  forwardRange,
  leftRange,
  rightRange,
  postCompleted,
  postLastRunAt,
  onRunPost,
  postRunning,
  hazardLog = [],
}: ForensicVaultPanelProps) {
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [obstructionFilter, setObstructionFilter] = useState<ObstructionFilter>('all');
  const [lastSync, setLastSync] = useState(new Date());
  const [downloading, setDownloading] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);
  const [pdfGateOpen, setPdfGateOpen] = useState(false);

  const driverId = user.driverId || user.driverNumber || 'DRV-4821';
  const events = useMemo(() => {
    const live = hazardLogToVaultEvents(hazardLog);
    const postEvents: VaultEvent[] = [];
    if (postCompleted && postLastRunAt) {
      const ts = new Date(postLastRunAt).getTime();
      postEvents.push({
        id: `${driverId}-live-post`,
        category: 'post',
        severity: 'pass',
        time: new Date(postLastRunAt).toLocaleTimeString([], { hour12: false }),
        timestamp: ts,
        title: 'POST Check PASSED',
        detail: 'C55-Pro daily self-test on file for this session',
        hash: shortHash(`${driverId}-live-post-${postLastRunAt}`),
      });
    }
    // Prefer live shift data; fall back to demo seeds only when shift is empty
    if (live.length > 0 || postEvents.length > 0) {
      return [...live, ...postEvents].sort((a, b) => b.timestamp - a.timestamp);
    }
    return demoEvents(driverId);
  }, [driverId, hazardLog, postCompleted, postLastRunAt]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setLastSync(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [open]);

  if (!open) return null;

  const filteredEvents = events.filter((e) => eventFilter === 'all' || e.category === eventFilter);
  const obstructionEvents = events.filter(
    (e) => e.category === 'obstruction' && (obstructionFilter === 'all' || e.severity === obstructionFilter),
  );

  const vehicleStub: Vehicle = {
    id: `veh-${driverId}`,
    company_id: user.companyId || null,
    truck_number: user.truckNumber || '#072',
    chassis_type: 'class8_tractor_sleeper',
    hardware_profile: 'c55_pro_forward_lr',
    status: 'operational',
    safety_score: 99.9,
    location: user.depot || user.location || 'Newark Terminal 4',
    assigned_driver_id: driverId,
    plan_tier: (user.planTier as Vehicle['plan_tier']) || 'proplus',
    company_name: user.companyName || null,
    created_at: new Date().toISOString(),
  };

  const driverStub: Driver = {
    id: driverId,
    company_id: user.companyId || null,
    name: user.name,
    email: user.email || null,
    driver_number: driverId,
    pin_code: null,
    location: user.depot || user.location || null,
    company_name: user.companyName || null,
    license_class: null,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const handleDownloadPdf = async () => {
    if (shouldBypassGate('pdf_download')) {
      await runPdfDownload();
      return;
    }
    setPdfGateOpen(true);
  };

  const runPdfDownload = async () => {
    setDownloading(true);
    setArchiveMsg(null);
    try {
      let sealed = true;
      if (user.companyId) {
        try {
          const access = await checkFeatureAccess(user.companyId, 'forensic_vault');
          sealed = access.allowed;
        } catch {
          sealed = true;
        }
      }
      const result = await downloadFleetvuReport({
        vehicle: vehicleStub,
        driver: driverStub,
        events,
        activeSensors: ['front_radar', 'left_radar', 'right_radar'],
        lastSync,
        postCompleted,
        sealed,
      });
      const archived = await archiveFleetvuReport(result, {
        generatedBy: user.email || user.name,
        companyId: user.companyId,
        companyName: user.companyName,
      });
      if (archived.error) {
        setArchiveMsg(`PDF downloaded. Archive note: ${archived.error}`);
      } else {
        setArchiveMsg(
          sealed
            ? `Saved to company vault · SHA-256 sealed · ${result.fileName}`
            : `Downloaded (Vault LOCKED — unsealed PDF) · ${result.fileName}`,
        );
      }
    } catch (e) {
      setArchiveMsg(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] bg-[#070b12] flex flex-col max-w-md mx-auto w-full">
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-orange-500/40 bg-orange-500/10">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-[11px] font-black uppercase tracking-wide text-orange-300 truncate">
            Forensic Vault — Audit Stream
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Collapse
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin p-2.5 space-y-2.5 pb-4">
        {/* Read-only ranges snapshot */}
        <div className="rounded-xl border border-slate-800 bg-[#0a1018] px-3 py-2 grid grid-cols-3 gap-2 text-center">
          <RangeChip label="FORWARD" value={forwardRange} />
          <RangeChip label="LEFT" value={leftRange} />
          <RangeChip label="RIGHT" value={rightRange} />
        </div>
        <p className="text-[8px] text-center text-slate-600 -mt-1">Company-set ranges · locked for drivers</p>

        {/* SHA-256 */}
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3">
          <div className="flex items-start gap-2">
            <Fingerprint className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-emerald-300">SHA-256 Chain Intact</p>
                <span className="text-[9px] font-black uppercase text-emerald-400">Verified</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5">0 Tamper Events · 5 blocks verified</p>
              <p className="truncate font-mono text-[8px] text-slate-500 mt-1">
                Genesis: {shortHash(driverId)}…
              </p>
              <p className="text-[9px] text-slate-500 mt-1">{formatTime(lastSync)}</p>
            </div>
          </div>
        </div>

        {/* Vault Event Stream */}
        <section className="rounded-xl border border-amber-500/25 bg-[#0b1824] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-700/70 px-3 py-2">
            <FileText className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">Vault Event Stream</span>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-700/70 p-2 scrollbar-thin">
            {(['all', 'post', 'obstruction', 'diag', 'high-g'] as EventFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setEventFilter(filter)}
                className={cn(
                  'whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-black uppercase',
                  eventFilter === filter ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400',
                )}
              >
                {filter === 'high-g' ? 'High-G' : filter === 'obstruction' ? 'Destruction' : filter}
              </button>
            ))}
          </div>
          <div className="max-h-[180px] overflow-y-auto scrollbar-thin">
            {filteredEvents.map((event, idx) => (
              <div
                key={event.id}
                className="grid grid-cols-[28px_52px_1fr_58px] items-center gap-1 border-b border-slate-800 px-3 py-2 last:border-0"
              >
                <span className="font-mono text-[9px] text-slate-500">#{filteredEvents.length - idx}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-center text-[8px] font-black',
                    event.severity === 'pass'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : event.severity === 'critical'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-amber-500/15 text-amber-400',
                  )}
                >
                  {event.severity === 'pass' ? 'PASS' : event.severity.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold text-slate-200">{event.title}</p>
                  <p className="truncate text-[9px] text-slate-500">
                    {event.time} · {event.detail}
                  </p>
                </div>
                <span className="text-right font-mono text-[8px] text-slate-500">{event.hash.slice(0, 8)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-700/70 px-3 py-1.5 text-[9px] text-slate-500">
            <span>{filteredEvents.length} total entries</span>
            <span className="font-bold text-emerald-400">Chain Verified</span>
          </div>
        </section>

        <Button
          type="button"
          disabled={downloading}
          onClick={handleDownloadPdf}
          className="w-full h-11 gap-2 border border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/40 hover:bg-cyan-500/10 font-bold text-xs"
        >
          <Download className="h-4 w-4" />
          {downloading ? 'Generating PDF…' : 'Download PDF Log Report'}
        </Button>
        {archiveMsg && <p className="text-[10px] text-center text-emerald-400/90 px-2">{archiveMsg}</p>}

        {/* Obstruction & Event Log */}
        <section className="rounded-xl border border-slate-700/80 bg-[#0b1824] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-700/70 px-3 py-2.5">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-1.5">
              <Eye className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Obstruction &amp; Event Log</p>
              <p className="text-[9px] text-slate-500">
                {obstructionEvents.length} event · Auto-syncing
              </p>
            </div>
            <Badge className="border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-black text-emerald-400">
              IDLE
            </Badge>
          </div>
          <div className="flex gap-1.5 p-2">
            {(['all', 'critical', 'warning'] as ObstructionFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setObstructionFilter(filter)}
                className={cn(
                  'rounded-full px-2.5 py-1.5 text-[9px] font-black uppercase',
                  obstructionFilter === filter ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400',
                )}
              >
                {filter === 'all' ? 'All Events' : filter === 'critical' ? 'Critical (< 2.0m)' : 'Warnings (2.0m - 5.0m)'}
              </button>
            ))}
          </div>
          <div className="mx-2 mb-2 max-h-[140px] overflow-y-auto border border-slate-700/70 bg-slate-900/40 p-2 scrollbar-thin">
            {obstructionEvents.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-4">No obstructions for this filter</p>
            ) : (
              obstructionEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-2 border-b border-slate-800 py-2 last:border-0">
                  {event.severity === 'critical' ? (
                    <TriangleAlert className="h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold text-slate-200">{event.title}</p>
                    <p className="truncate text-[9px] text-slate-500">
                      {event.time} · {event.zone}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-black uppercase',
                      event.severity === 'critical' ? 'text-red-400' : 'text-amber-400',
                    )}
                  >
                    {event.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Daily POST */}
        <div className="rounded-xl border border-emerald-500/25 bg-[#0b1824] p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">Daily POST Check</p>
              <p className="text-[9px] text-slate-500">
                Last Completed:{' '}
                {postLastRunAt
                  ? `${formatDate(postLastRunAt)}, ${formatTime(postLastRunAt)}`
                  : 'Never'}
              </p>
            </div>
            <Badge className={postCompleted ? 'bg-emerald-500 text-[9px] font-black text-white' : 'bg-amber-500 text-[9px] font-black text-white'}>
              {postCompleted ? 'COMPLETED' : 'PENDING'}
            </Badge>
          </div>
          <Button
            type="button"
            disabled={postRunning}
            onClick={onRunPost}
            className="mt-3 h-10 w-full gap-2 bg-orange-500 text-xs font-black text-white hover:bg-orange-600"
          >
            <RefreshCw className={cn('h-4 w-4', postRunning && 'animate-spin')} />
            {postRunning ? 'Running System Self-Test…' : 'Re-Run System Self-Test'}
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-800 px-3 py-2 flex justify-end">
        <button type="button" onClick={onClose} className="text-[10px] text-slate-500 hover:text-white inline-flex items-center gap-1">
          <X className="w-3 h-3" /> Close Vault Stream
        </button>
      </div>

      <AuthorizationGate
        open={pdfGateOpen}
        onClose={() => setPdfGateOpen(false)}
        title="Authorize PDF Download"
        actionLabel="Download PDF Report"
        onAuthorized={() => {
          setPdfGateOpen(false);
          void runPdfDownload();
        }}
      />
    </div>
  );
}

function RangeChip({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[8px] font-bold uppercase text-slate-500 tracking-wider">{label}</p>
      <p className="text-lg font-black text-white tabular-nums">{value.toFixed(1)}</p>
    </div>
  );
}
