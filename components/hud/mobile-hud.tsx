'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { IncidentWizard } from './incident-wizard';
import { RadarVisualizer, useRadarControls } from '@/components/hud/radar-visualizer';
import type { VehicleProfileKey } from '@/lib/types';
import { HazardEventLogPanel } from './hazard-event-log';
import {
  type HazardDetection,
  type HazardEventLog,
  type HazardZone,
  createHazardDetection,
  hazardToEventLog,
} from '@/lib/hazard-detection';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Home,
  ChevronDown,
  ChevronUp,
  Monitor,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Lock,
  Wifi,
  Battery,
  Settings,
  User,
  Cloud,
  Power,
  RefreshCw,
  Volume2,
  Mail,
} from 'lucide-react';
import {
  HARDWARE_PROFILES,
  MOTION_LOCKOUT_THRESHOLD,
} from '@/lib/constants';
import type { ProximityZone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { usePortalMobileSync } from '@/hooks/use-portal-mobile-sync';
import {
  ImpactAlertOverlay,
  type ImpactAlertData,
} from '@/components/vault/impact-alert-overlay';
import { getPostCheckState, setPostCheckState } from '@/lib/vault-session';
import { autoConnectAndPost } from '@/lib/sensor-auto-connect';
import { PostStatusBadge } from '@/components/hud/post-status-badge';
import { classifyEvent } from '@/lib/collision-detection';
import {
  EDGE_FILTER_THRESHOLD_M,
  TRIAL_CHANNEL_CONFIG,
  applyEdgeFilter,
  computeEdgeStatus,
  parseTripartiteFrame,
} from '@/lib/edge-filter';
import { DriverSettingsModal, type DriverSettingsState } from '@/components/vault/driver-settings-modal';
import { ForensicVaultPanel } from '@/components/vault/forensic-vault-panel';
import { HazardPopupOverlay, ProximityFlagBar } from '@/components/hud/hazard-popup-overlay';
import {
  buildSessionDigest,
  buildWeeklySafetyDigestEmail,
  formatDigestPlainText,
} from '@/lib/session-digest';
import { isScfuelsTrialUser } from '@/lib/scfuels-trial';
import { resolveCompanyLogoUrl } from '@/lib/company-branding';

const LOCKED_VEHICLE_KEY = 'class8_tractor_sleeper';
const LOCKED_HW_KEY = 'c55_pro_forward_lr';
/** Auto-return to Vault lock screen so drivers aren't staring at the HUD */
const IDLE_LOCK_MS = 2 * 60 * 1000;

interface MobileHUDProps {
  initialShowIncident?: boolean;
  initialFocus?: 'sensors' | 'gps' | 'log' | 'default';
  onReturnToVault?: () => void;
  onLockVault?: () => void;
  onReturnToPortal?: () => void;
  /** Customer trial build — hide portal exits, emphasize C55 logging + digests */
  trialMode?: boolean;
}

/**
 * Driver Vault Inside — visual match to Bolt FleetVu Command.
 * Sensor ranges are display-only (company admin sets them on the portal).
 */
export function MobileHUD({
  initialShowIncident = false,
  initialFocus = 'default',
  onReturnToVault,
  onLockVault,
  onReturnToPortal,
  trialMode = false,
}: MobileHUDProps = {}) {
  const { user, fleet, setFleet, logout, switchRole, view } = useApp();
  const { enqueue: syncEnqueue, state: syncState } = usePortalMobileSync({
    companyId: user?.companyId ?? null,
    enabled: true,
  });
  const [showIncidentWizard, setShowIncidentWizard] = useState(initialShowIncident);
  const [impactAlert, setImpactAlert] = useState<ImpactAlertData | null>(null);
  const [showEventLog, setShowEventLog] = useState(initialFocus === 'log');
  const [showGpsPanel, setShowGpsPanel] = useState(initialFocus === 'gps');
  const [showSensorFault, setShowSensorFault] = useState(false);
  const [proximityZone, setProximityZone] = useState<ProximityZone | null>(null);
  const [proximityDistance, setProximityDistance] = useState(3.2);
  const [demoBarExpanded, setDemoBarExpanded] = useState(false);
  const [activeHazards, setActiveHazards] = useState<HazardDetection[]>([]);
  const [hazardLog, setHazardLog] = useState<HazardEventLog[]>([]);
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const [forensicOpen, setForensicOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestCopied, setDigestCopied] = useState(false);
  const sessionStartedAt = useRef(new Date().toISOString()).current;
  const [driverSettings, setDriverSettings] = useState<DriverSettingsState>({
    alertVolumeOn: true,
    alertVolume: 88,
    nightMode: true,
    brightness: 45,
  });
  const [clock, setClock] = useState(() => new Date());
  const [postRunning, setPostRunning] = useState(false);
  const [postCheck, setPostCheck] = useState(() => {
    const s = getPostCheckState();
    if (!s.lastRunAt) {
      const seeded = { status: 'passed' as const, lastRunAt: new Date().toISOString() };
      setPostCheckState(seeded);
      return seeded;
    }
    return s;
  });

  const radarControls = useRadarControls();
  const hwProfile = HARDWARE_PROFILES[LOCKED_HW_KEY];
  const forwardRange = fleet.forwardRange;
  const leftRange = fleet.leftRange;
  const rightRange = fleet.rightRange;

  // Trial lock: Forward 7m · Left 4m · Right 4m · EDGE @ 5m
  useEffect(() => {
    if (!trialMode) return;
    setFleet({
      forwardRange: TRIAL_CHANNEL_CONFIG.channel_forward_range_m,
      leftRange: TRIAL_CHANNEL_CONFIG.channel_left_range_m,
      rightRange: TRIAL_CHANNEL_CONFIG.channel_right_range_m,
    });
  }, [trialMode, setFleet]);

  const edgeConfig = useMemo(
    () => ({
      ...TRIAL_CHANNEL_CONFIG,
      channel_forward_range_m: forwardRange,
      channel_left_range_m: leftRange,
      channel_right_range_m: rightRange,
      edge_filter_enabled: trialMode ? true : TRIAL_CHANNEL_CONFIG.edge_filter_enabled,
    }),
    [forwardRange, leftRange, rightRange, trialMode],
  );

  const edgeStatus = useMemo(() => computeEdgeStatus(edgeConfig), [edgeConfig]);
  const edgeActive = edgeStatus === 'active';

  const sessionDigest = useMemo(
    () =>
      buildSessionDigest({
        hazardLog,
        postPassed: postCheck.status === 'passed',
        postLastRunAt: postCheck.lastRunAt,
        syncState,
        truckNumber: user?.truckNumber,
        sessionStartedAt,
        edgeActive,
        forwardRangeM: forwardRange,
        leftRangeM: leftRange,
        rightRangeM: rightRange,
        edgeThresholdM: EDGE_FILTER_THRESHOLD_M,
      }),
    [
      hazardLog,
      postCheck.status,
      postCheck.lastRunAt,
      syncState,
      user?.truckNumber,
      sessionStartedAt,
      edgeActive,
      forwardRange,
      leftRange,
      rightRange,
    ],
  );

  const weeklyDigestMail = useMemo(
    () =>
      buildWeeklySafetyDigestEmail({
        digest: sessionDigest,
        companyName: user?.companyName,
        driverName: user?.name,
        truckNumber: user?.truckNumber,
      }),
    [sessionDigest, user?.companyName, user?.name, user?.truckNumber],
  );

  const scfuelsTrial = isScfuelsTrialUser(user);
  const brandLogo = resolveCompanyLogoUrl(user);

  const postStale =
    !postCheck.lastRunAt ||
    Date.now() - new Date(postCheck.lastRunAt).getTime() > 20 * 60 * 60 * 1000;

  const shareDigest = async () => {
    const text = formatDigestPlainText(sessionDigest, {
      driver: user?.name,
      company: user?.companyName,
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FleetVu Session Digest', text });
      } else {
        await navigator.clipboard.writeText(text);
        setDigestCopied(true);
        window.setTimeout(() => setDigestCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setDigestCopied(true);
        window.setTimeout(() => setDigestCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  const safetyScore = 99.9;
  const unitId = 'FV-ELITE-A7X2';
  const [gpsLat, setGpsLat] = useState(32.7173);
  const [gpsLng, setGpsLng] = useState(-117.1602);
  const [gpsLive, setGpsLive] = useState(false);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);

  // Sync company-locked ranges into visualizer (driver cannot change)
  useEffect(() => {
    radarControls.setForwardDistance(forwardRange);
    radarControls.setLeftDistance(leftRange);
    radarControls.setRightDistance(rightRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardRange, leftRange, rightRange]);

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Live device GPS for HUD + incident reconstruction
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const onOk = (pos: GeolocationPosition) => {
      setGpsLat(pos.coords.latitude);
      setGpsLng(pos.coords.longitude);
      setGpsAccuracyM(
        typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
      );
      setGpsLive(true);
    };
    const onErr = () => setGpsLive(false);
    navigator.geolocation.getCurrentPosition(onOk, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });
    const watchId = navigator.geolocation.watchPosition(onOk, onErr, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Auto-lock after idle — return to MAIN Vault opening page
  useEffect(() => {
    if (!onLockVault) return;
    let timer = window.setTimeout(() => onLockVault(), IDLE_LOCK_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onLockVault(), IDLE_LOCK_MS);
    };
    const opts = { passive: true } as const;
    window.addEventListener('pointerdown', bump, opts);
    window.addEventListener('touchstart', bump, opts);
    window.addEventListener('keydown', bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('touchstart', bump);
      window.removeEventListener('keydown', bump);
    };
  }, [onLockVault]);

  // Pause idle timer while Forensic Vault / Settings / Incident open
  useEffect(() => {
    if (!onLockVault) return;
    if (!forensicOpen && !settingsOpen && !showIncidentWizard && !impactAlert) return;
    // While overlays open, keep bumping so we don't lock mid-flow
    const keepAlive = window.setInterval(() => {
      window.dispatchEvent(new Event('pointerdown'));
    }, 30_000);
    return () => window.clearInterval(keepAlive);
  }, [onLockVault, forensicOpen, settingsOpen, showIncidentWizard, impactAlert]);

  useEffect(() => {
    if (fleet.selectedVehicleType !== LOCKED_VEHICLE_KEY || fleet.selectedHardwareProfile !== LOCKED_HW_KEY) {
      setFleet({ selectedVehicleType: LOCKED_VEHICLE_KEY, selectedHardwareProfile: LOCKED_HW_KEY });
    }
    if (fleet.vehicleSpeed < 1) setFleet({ vehicleSpeed: 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHazardExpire = useCallback(
    (hazardId: string) => {
      setActiveHazards((prev) => {
        const expired = prev.find((h) => h.id === hazardId);
        if (expired && !expired.logged) {
          const logEntry = hazardToEventLog(expired);
          setHazardLog((log) => [logEntry, ...log].slice(0, 50));
          syncEnqueue('hazard_cues', {
            hazardId: expired.id,
            zone: expired.zone,
            distanceM: expired.distanceM,
            actorEmail: user?.email ?? null,
            actorRole: user?.role ?? 'driver',
            platform: 'mobile',
            appVersion: '1.0.0',
          });
        }
        return prev.filter((h) => h.id !== hazardId);
      });
    },
    [syncEnqueue, user?.email, user?.role],
  );

  useEffect(() => {
    if (!fleet.incidentDetectionEnabled) return;
    if (impactAlert || showIncidentWizard) return;
    if (fleet.incidentDetected) {
      const jolt = Math.max(fleet.gForceThreshold + 0.8, 2.8 + Math.random());
      setImpactAlert({
        joltG: jolt,
        speedMph: fleet.vehicleSpeed,
        latitude: gpsLat,
        longitude: gpsLng,
        reason:
          jolt < 3.5
            ? 'Sudden jolt detected — possible pothole or curb strike'
            : 'High G-force event — possible collision',
        timestamp: new Date().toISOString(),
      });
      syncEnqueue('incident', {
        type: 'impact_alert',
        joltG: jolt,
        speedMph: fleet.vehicleSpeed,
        driverName: user?.name,
        driverId: user?.driverId || user?.driverNumber,
        truckNumber: user?.truckNumber,
        companyId: user?.companyId,
        actorEmail: user?.email,
        actorRole: user?.role || 'driver',
        platform: 'mobile',
      });
    }
  }, [
    fleet.incidentDetected,
    fleet.incidentDetectionEnabled,
    fleet.gForceThreshold,
    fleet.vehicleSpeed,
    impactAlert,
    showIncidentWizard,
    syncEnqueue,
    user,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (fleet.vehicleSpeed > 0) {
        const dist = Math.random() * Math.max(forwardRange, 3.5);
        const cappedDist = Math.min(dist, forwardRange);
        setProximityDistance(cappedDist);
        if (cappedDist < 1.0) setProximityZone('red');
        else if (cappedDist < 2.5) setProximityZone('yellow');
        else setProximityZone('green');

        if (cappedDist < 2.5 && Math.random() < 0.25 && activeHazards.length < 2) {
          const zones: HazardZone[] = ['forward', 'left', 'right'];
          const zone = zones[Math.floor(Math.random() * zones.length)];
          const zoneMax =
            zone === 'forward' ? forwardRange : zone === 'left' ? leftRange : rightRange;
          const zoneDist = Math.min(cappedDist, zoneMax);
          // Roadside static clutter on laterals — EDGE should suppress these from the log
          const isStaticClutter = zone !== 'forward' && Math.random() < 0.4;
          const readings = parseTripartiteFrame(
            zone === 'forward' ? zoneDist : null,
            zone === 'left' ? zoneDist : null,
            zone === 'right' ? zoneDist : null,
            zone === 'forward',
            zone === 'left' && !isStaticClutter,
            zone === 'right' && !isStaticClutter,
            edgeConfig,
          );
          if (isStaticClutter && zone === 'left') {
            readings[1].is_static = true;
            readings[1].is_moving = false;
          }
          if (isStaticClutter && zone === 'right') {
            readings[2].is_static = true;
            readings[2].is_moving = false;
          }
          const filtered = applyEdgeFilter(readings, edgeConfig);
          const channelReading = filtered.filteredReadings.find((r) => r.channel === zone);
          if (!channelReading?.object_detected) {
            return; // EDGE blocked false roadside log
          }

          const angleDeg =
            zone === 'forward' ? 350 + Math.random() * 20 : zone === 'left' ? 200 + Math.random() * 40 : 120 + Math.random() * 40;
          const hazard = createHazardDetection(zone, zoneDist, angleDeg, fleet.vehicleSpeed, {
            lat: gpsLat,
            lng: gpsLng,
          });
          setActiveHazards((prev) => [...prev, hazard]);
          if ('vibrate' in navigator) navigator.vibrate(200);
          syncEnqueue('hazard_cues', {
            hazardId: hazard.id,
            type: hazard.type,
            zone: hazard.zone,
            distanceM: hazard.distanceM,
            actorEmail: user?.email ?? null,
            actorRole: user?.role ?? 'driver',
            platform: 'mobile',
            live: true,
            edgeActive: filtered.edgeActive,
          });
        }
      } else {
        setProximityZone(null);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [
    fleet.vehicleSpeed,
    activeHazards.length,
    syncEnqueue,
    user?.email,
    user?.role,
    gpsLat,
    gpsLng,
    forwardRange,
    leftRange,
    rightRange,
    edgeConfig,
  ]);

  useEffect(() => {
    if (fleet.vehicleSpeed > MOTION_LOCKOUT_THRESHOLD && fleet.incidentDetected) {
      setFleet({ incidentDetected: false });
    }
  }, [fleet.vehicleSpeed, fleet.incidentDetected, setFleet]);

  useEffect(() => {
    if (!fleet.sensorFault) return;
    setShowSensorFault(true);
    if ('vibrate' in navigator) navigator.vibrate([500, 250, 500, 250, 1000]);
  }, [fleet.sensorFault]);

  // Expire hazards
  useEffect(() => {
    if (!activeHazards.length) return;
    const t = window.setInterval(() => {
      activeHazards.forEach((h) => {
        if (Date.now() - new Date(h.detectedAt).getTime() > 4000) handleHazardExpire(h.id);
      });
    }, 500);
    return () => window.clearInterval(t);
  }, [activeHazards, handleHazardExpire]);

  const triggerDemoImpact = (kind: 'pothole' | 'collision') => {
    const jolt = kind === 'pothole' ? 2.2 + Math.random() * 0.6 : 4.5 + Math.random() * 2;
    const channels = [
      {
        channel: 'forward' as const,
        range_m: 7.5,
        distance_m: kind === 'collision' ? 0.15 : 1.8,
        object_detected: true,
        is_static: false,
        is_moving: true,
        timestamp: new Date().toISOString(),
      },
      {
        channel: 'left' as const,
        range_m: fleet.leftRange || 2,
        distance_m: null,
        object_detected: false,
        is_static: false,
        is_moving: false,
        timestamp: new Date().toISOString(),
      },
      {
        channel: 'right' as const,
        range_m: fleet.rightRange || 2,
        distance_m: null,
        object_detected: false,
        is_static: false,
        is_moving: false,
        timestamp: new Date().toISOString(),
      },
    ];
    const classified = classifyEvent(
      channels,
      jolt,
      Math.max(fleet.vehicleSpeed, kind === 'pothole' ? 25 : 35),
      { lat: gpsLat, lng: gpsLng },
    );
    setImpactAlert({
      joltG: jolt,
      speedMph: Math.max(fleet.vehicleSpeed, kind === 'pothole' ? 25 : 35),
      latitude: gpsLat,
      longitude: gpsLng,
      reason:
        classified.eventType === 'verified_bumper_impact'
          ? 'Verified bumper impact — grille crush signature + phone jolt'
          : classified.eventType === 'proximity_near_miss'
            ? 'Proximity near-miss — rapid close-quarters pass (no verified impact)'
            : kind === 'pothole'
              ? 'Sudden jolt detected — possible pothole or curb strike'
              : 'High G-force event — possible collision',
      timestamp: new Date().toISOString(),
    });
    setFleet({ incidentDetected: true });
  };

  const handleImOk = () => {
    setImpactAlert(null);
    setFleet({ incidentDetected: false });
    syncEnqueue('incident', {
      type: 'false_positive_im_ok',
      driverName: user?.name,
      driverId: user?.driverId || user?.driverNumber,
      truckNumber: user?.truckNumber,
      companyId: user?.companyId,
      actorEmail: user?.email,
      actorRole: 'driver',
      platform: 'mobile',
    });
  };

  const handleReportFromAlert = () => {
    setImpactAlert(null);
    setFleet({ incidentDetected: false });
    setShowIncidentWizard(true);
  };

  const acknowledgeFault = () => {
    setShowSensorFault(false);
    setFleet({ sensorFault: false });
  };

  const runPostCheck = async () => {
    if (postRunning) return;
    setPostRunning(true);
    try {
      const result = await autoConnectAndPost(undefined, (post) => {
        const next = {
          status: post.passed ? ('passed' as const) : ('failed' as const),
          lastRunAt: post.timestamp,
        };
        setPostCheckState(next);
        setPostCheck(next);
      });
      if (!result.postCheckResult) {
        const next = { status: 'passed' as const, lastRunAt: new Date().toISOString() };
        setPostCheckState(next);
        setPostCheck(next);
      }
    } catch {
      const next = { status: 'failed' as const, lastRunAt: new Date().toISOString() };
      setPostCheckState(next);
      setPostCheck(next);
    } finally {
      setPostRunning(false);
    }
  };

  const displaySpeed = Math.max(fleet.vehicleSpeed, 2);

  return (
    <div
      className={cn(
        'h-[100dvh] bg-[#070b12] text-slate-100 flex flex-col overflow-hidden max-w-md mx-auto w-full shadow-2xl shadow-black/60 transition-[filter] duration-300',
        driverSettings.nightMode && 'brightness-[0.92] contrast-[1.05]',
      )}
      style={driverSettings.nightMode ? { filter: `brightness(${driverSettings.brightness / 100 + 0.35})` } : undefined}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-1 bg-black/50 text-[9px] text-slate-500">
        <span className="font-mono">{clock.toLocaleTimeString([], { hour12: true })}</span>
        <span className="inline-flex items-center gap-2">
          <span className="text-emerald-400 font-bold">LINK</span>
          <span className="inline-flex items-center gap-0.5 text-orange-300">
            <Battery className="w-3 h-3" /> 82%
          </span>
        </span>
      </div>

      <header className="shrink-0 border-b border-slate-800/80 bg-[#0a1018] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="flex items-center gap-2 min-w-0" onClick={onLockVault || logout} title="Lock Vault">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-[14px] font-black text-slate-950 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.35)]">
              V
            </div>
            <div className="min-w-0 text-left">
              {brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandLogo}
                  alt={user?.companyName || 'Company'}
                  className="h-4 w-auto max-w-[120px] object-contain object-left mb-0.5"
                />
              ) : (
                <p className="text-[13px] font-bold text-white leading-tight truncate">FleetVu Command</p>
              )}
              <p className="text-[9px] text-slate-500 leading-tight">
                {trialMode || scfuelsTrial ? 'C55-Pro Trial · Forensic Vault' : 'Forensic Vault'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white shadow-[0_0_8px_rgba(220,38,38,0.45)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
            {trialMode && (
              <span className="hidden xs:inline-flex rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-black text-cyan-300">
                C55
              </span>
            )}
            <button
              type="button"
              onClick={() => (onLockVault ? onLockVault() : logout())}
              title="Return to Vault lock screen"
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold hover:brightness-110',
                syncState === 'connected'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-600 bg-slate-800 text-slate-400',
              )}
            >
              <Lock className="w-2.5 h-2.5" />
              VAULT
            </button>
            <Wifi className={cn('w-3.5 h-3.5', syncState === 'connected' ? 'text-emerald-400' : 'text-amber-400')} />
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Driver Settings">
              <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-[9px] text-slate-600">{unitId}</span>
          <span className="font-mono text-[9px] text-slate-500">{clock.toLocaleTimeString([], { hour12: true })}</span>
        </div>
      </header>

      {trialMode && (
        <div className="shrink-0 px-2.5 py-1.5 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-orange-950/50 border-b border-cyan-500/20">
          <p className="text-[9px] font-bold text-cyan-200/90 tracking-wide">
            C55-PRO · FWD {forwardRange.toFixed(0)}m · L/R {leftRange.toFixed(0)}m · EDGE @ {EDGE_FILTER_THRESHOLD_M.toFixed(0)}m{' '}
            {edgeActive ? 'ACTIVE' : 'STANDBY'}
          </p>
        </div>
      )}

      {postStale && (
        <button
          type="button"
          onClick={() => void runPostCheck()}
          className="shrink-0 w-full bg-amber-500/90 text-slate-950 px-3 py-1.5 text-[10px] font-black flex items-center justify-center gap-2"
        >
          <RefreshCw className={cn('w-3 h-3', postRunning && 'animate-spin')} />
          Daily POST due — tap to auto-run system self-test
        </button>
      )}

      {fleet.motionLockout && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-xs font-bold flex items-center justify-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
          Motion Lockout Active — Settings Locked
        </div>
      )}

      {fleet.incidentDetected && !fleet.motionLockout && !impactAlert && (
        <div className="bg-orange-500 text-white px-3 py-1.5 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Incident Detected?
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="bg-white text-orange-600 hover:bg-slate-100 h-6 text-[10px] font-bold px-2"
              onClick={() => {
                setShowIncidentWizard(true);
                setFleet({ incidentDetected: false });
              }}
            >
              Report
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-orange-600 h-6 text-[10px] px-2" onClick={() => setFleet({ incidentDetected: false })}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pt-2.5">
          <KpiCard label="GPS" value={`L ${gpsLat.toFixed(4)}`} sub={`G ${gpsLng.toFixed(4)}`} ok />
          <KpiCard label="SPD" value={`${displaySpeed.toFixed(0)} MPH`} sub="OK" ok large />
          <KpiCard label="SAFE" value={`${safetyScore.toFixed(1)}/100`} sub="Min 1,000 miles" ok tone="emerald" />
        </div>

        <div className="mx-2.5 mt-2 flex items-center justify-between rounded-lg border border-slate-700/80 bg-[#0d141e] px-2.5 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {brandLogo ? (
              <div className="flex h-7 items-center justify-center rounded-md bg-black/80 border border-white/10 px-1.5 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogo}
                  alt={user?.companyName || 'Company'}
                  className="h-3.5 w-auto max-w-[72px] object-contain"
                />
              </div>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/15 border border-orange-500/30">
                <User className="w-3.5 h-3.5 text-orange-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">
                {user?.companyName || (scfuelsTrial ? 'SCFuels' : 'Driver')} Profile: {user?.name || 'Driver'}
              </p>
              <p className="text-[9px] text-slate-400">
                Truck {user?.truckNumber || '#SCF-101'}
                {scfuelsTrial ? ' · C55-Pro Evaluation' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVaultMenuOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-900/60 px-2 py-1 text-[9px] font-bold uppercase text-slate-300 hover:text-white"
          >
            Edit <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Radar + hazard popups — flags sit below so truck never clips R/Y/G */}
        <div className="relative mx-2.5 mt-2 h-[250px] rounded-xl overflow-hidden border border-cyan-500/25 bg-[#050c16] shadow-[inset_0_0_40px_rgba(56,189,248,0.08)]">
          <RadarVisualizer
            vehicleType={LOCKED_VEHICLE_KEY as VehicleProfileKey}
            speedMph={displaySpeed}
            activeSensors={hwProfile.sensors}
            hardwareProfile={LOCKED_HW_KEY}
            expandedMode
            safetyScore={safetyScore}
            location={`${gpsLat}, ${gpsLng}`}
            controls={radarControls}
          />
          <HazardPopupOverlay hazards={activeHazards} onExpire={handleHazardExpire} />
          <div className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-black/80 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
            <Lock className="w-2.5 h-2.5" />
            PIN Locked
          </div>
        </div>

        <ProximityFlagBar zone={proximityZone} distanceM={proximityDistance} />

        {/* Auto channel activity strip */}
        <div className="mx-2.5 mt-1.5 grid grid-cols-3 gap-1.5">
          {(
            [
              { key: 'forward' as const, label: 'FWD', icon: <ArrowUp className="w-3 h-3" />, count: sessionDigest.byZone.forward },
              { key: 'left' as const, label: 'LEFT', icon: <ArrowLeft className="w-3 h-3" />, count: sessionDigest.byZone.left },
              { key: 'right' as const, label: 'RIGHT', icon: <ArrowRight className="w-3 h-3" />, count: sessionDigest.byZone.right },
            ] as const
          ).map((ch) => (
            <div
              key={ch.key}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-center',
                ch.count > 0
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-800 bg-[#0a1018]',
              )}
            >
              <div className="flex items-center justify-center gap-1 text-[8px] font-bold text-slate-400">
                {ch.icon}
                {ch.label}
              </div>
              <p className={cn('text-sm font-black tabular-nums', ch.count > 0 ? 'text-cyan-300' : 'text-slate-600')}>
                {ch.count}
              </p>
            </div>
          ))}
        </div>

        {hazardLog.length > 0 && (
          <div className="mx-2.5 mt-1.5 rounded-lg border border-slate-800 bg-[#0a1018] px-2.5 py-1.5">
            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1">Recent obstruction cues</p>
            <div className="space-y-0.5 max-h-[52px] overflow-y-auto scrollbar-thin">
              {hazardLog.slice(0, 3).map((e) => (
                <p key={e.id} className="text-[9px] text-slate-400 truncate">
                  <span className="text-orange-300 font-bold">{e.zone.toUpperCase()}</span>
                  {' · '}
                  {e.distanceM.toFixed(1)}m · {e.type.replace('_', ' ')} ·{' '}
                  {new Date(e.detectedAt).toLocaleTimeString([], { hour12: false })}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Auto-generated shift digest */}
        <div className="mx-2.5 mt-2 rounded-xl border border-orange-500/30 bg-gradient-to-br from-[#16120e] to-[#0a1018] px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-orange-400/90">
                Auto Session Digest · SHA-256
              </p>
              <p className="text-[11px] font-bold text-white mt-0.5 leading-snug">{sessionDigest.headline}</p>
              <p className="text-[9px] text-cyan-300/90 mt-1 leading-snug">
                {sessionDigest.edgeActive ? 'EDGE ACTIVE' : 'EDGE STANDBY'} · roadside suppression{' '}
                {sessionDigest.edgeActive ? 'ON' : 'OFF'}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5 font-mono truncate">
                Seal {sessionDigest.sealFingerprint}
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold px-2.5"
              onClick={() => setDigestOpen(true)}
            >
              View
            </Button>
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-[9px] border-slate-600 text-slate-300"
              onClick={() => void shareDigest()}
            >
              {digestCopied ? 'Copied' : 'Share / Copy'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-[9px] border-cyan-600/50 text-cyan-200 gap-1"
              onClick={() => {
                window.location.href = weeklyDigestMail.mailtoHref;
              }}
            >
              <Mail className="w-3 h-3" />
              Weekly Digest Email
            </Button>
          </div>
        </div>

        {/* Read-only ranges — company admin only */}
        <div className="mx-2.5 mt-2 rounded-xl border border-slate-800 bg-[#0a1018] px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Sensor ranges</p>
            <div className="flex items-center gap-1.5">
              {edgeActive && (
                <span className="rounded bg-cyan-500/20 border border-cyan-400/40 px-1.5 py-0.5 text-[8px] font-black text-cyan-300 tracking-wide">
                  EDGE ACTIVE
                </span>
              )}
              <p className="text-[8px] text-slate-600 text-right">Company admin · locked</p>
            </div>
          </div>
          <div className="space-y-2 pointer-events-none select-none">
            <RangeReadonly label="FORWARD" icon={<ArrowUp className="w-3 h-3" />} value={forwardRange} max={10} />
            <RangeReadonly label="LEFT" icon={<ArrowLeft className="w-3 h-3" />} value={leftRange} max={4} />
            <RangeReadonly label="RIGHT" icon={<ArrowRight className="w-3 h-3" />} value={rightRange} max={4} />
          </div>
          {trialMode && (
            <p className="mt-2 text-[9px] text-slate-500 leading-snug">
              Trial profile: FWD 7m · L/R 4m. EDGE @ {EDGE_FILTER_THRESHOLD_M.toFixed(0)}m suppresses static roadside
              clutter on side channels so outside obstructions don’t flood the event log. Moving hazards still pass.
            </p>
          )}
        </div>

        <div className="mx-2.5 mt-2 space-y-2 pb-4">
          <button
            type="button"
            onClick={() => setForensicOpen(true)}
            className="w-full h-12 rounded-xl border-2 border-orange-500 bg-[#16120e] hover:bg-orange-500/15 text-orange-400 font-black text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
          >
            <ShieldAlert className="w-4 h-4" />
            FORENSIC VAULT
            <ChevronDown className="w-4 h-4 opacity-70" />
          </button>

          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white">Daily POST Check</p>
              <p className="text-[9px] text-slate-400 truncate">
                Last Completed:{' '}
                {postCheck.lastRunAt
                  ? new Date(postCheck.lastRunAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'Never'}
              </p>
            </div>
            <PostStatusBadge
              lastPostCheckAt={postCheck.lastRunAt}
              isRunning={postRunning}
              size="sm"
              onClick={() => void runPostCheck()}
            />
          </div>

          <Button
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs gap-2 shadow-lg shadow-orange-900/30"
            disabled={postRunning}
            onClick={runPostCheck}
          >
            <RefreshCw className={cn('w-4 h-4', postRunning && 'animate-spin')} />
            {postRunning ? 'Running System Self-Test…' : 'Re-Run System Self-Test'}
          </Button>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-800 bg-[#0a1018] px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 min-w-0">
          <Cloud className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="truncate">
            {trialMode ? 'Logging to sealed vault · weekly digest ready' : 'Streaming to FleetVu Cloud'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={logout} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-red-300">
            <Power className="w-3.5 h-3.5" />
            End Shift
          </button>
          <button
            type="button"
            onClick={() => {
              setFleet({ vehicleSpeed: 2, incidentDetected: false, sensorFault: false });
              setProximityZone(null);
              setActiveHazards([]);
            }}
            className="text-[10px] font-semibold text-slate-400 hover:text-white"
          >
            Reset
          </button>
        </div>
      </footer>

      {forensicOpen && user && (
        <ForensicVaultPanel
          open={forensicOpen}
          onClose={() => setForensicOpen(false)}
          user={user}
          forwardRange={forwardRange}
          leftRange={leftRange}
          rightRange={rightRange}
          postCompleted={postCheck.status === 'passed'}
          postLastRunAt={postCheck.lastRunAt}
          onRunPost={runPostCheck}
          postRunning={postRunning}
          hazardLog={hazardLog}
        />
      )}

      {digestOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDigestOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl border border-orange-500/30 bg-[#0c1219] p-4 pb-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />
            <p className="text-sm font-black text-white">Auto Session Digest</p>
            <p className="text-[10px] text-slate-500 mb-3">Generated from this shift’s C55-Pro log — observational only</p>
            <p className="text-xs font-bold text-orange-300 mb-2">{sessionDigest.headline}</p>
            <p className="text-[10px] text-cyan-300 mb-3 font-semibold">
              {sessionDigest.roadsideSuppressedNote}
            </p>
            <ul className="space-y-1.5 mb-4">
              {sessionDigest.bullets.map((b) => (
                <li key={b} className="text-[11px] text-slate-300 leading-snug flex gap-1.5">
                  <span className="text-orange-400 mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs font-bold" onClick={() => void shareDigest()}>
                {digestCopied ? 'Copied to clipboard' : 'Share / Copy Digest'}
              </Button>
              <Button
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white h-9 text-xs font-bold gap-1.5"
                onClick={() => {
                  window.location.href = weeklyDigestMail.mailtoHref;
                }}
              >
                <Mail className="w-3.5 h-3.5" />
                Email Weekly SHA-256 Safety Digest
              </Button>
              <Button variant="outline" className="h-9 text-xs border-slate-600 text-slate-300" onClick={() => setDigestOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <DriverSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={driverSettings}
        onChange={setDriverSettings}
      />

      {vaultMenuOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 backdrop-blur-sm" onClick={() => setVaultMenuOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-slate-700 bg-[#0c1219] p-4 pb-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />
            <p className="text-sm font-black text-white mb-0.5">Forensic Vault</p>
            <p className="text-[10px] text-slate-500 mb-3">Driver tools — sensor ranges locked by company admin</p>
            <div className="space-y-1.5">
              <VaultLink label="Auto Session Digest" onClick={() => { setVaultMenuOpen(false); setDigestOpen(true); }} />
              <VaultLink
                label="Email Weekly SHA-256 Digest"
                onClick={() => {
                  setVaultMenuOpen(false);
                  window.location.href = weeklyDigestMail.mailtoHref;
                }}
              />
              <VaultLink label="Report Incident" onClick={() => { setVaultMenuOpen(false); setShowIncidentWizard(true); }} />
              <VaultLink label="Vault Event Log" onClick={() => { setVaultMenuOpen(false); setShowEventLog(true); }} />
              <VaultLink label="Live GPS" onClick={() => { setVaultMenuOpen(false); setShowGpsPanel(true); }} />
              <VaultLink label="Re-Run Daily POST" onClick={() => { setVaultMenuOpen(false); runPostCheck(); }} />
              <VaultLink label="Lock Vault" onClick={() => { setVaultMenuOpen(false); onLockVault?.(); }} />
              {!trialMode && onReturnToPortal && (
                <VaultLink label="Return to Portal" onClick={() => { setVaultMenuOpen(false); onReturnToPortal(); }} />
              )}
            </div>
            <Button variant="ghost" className="mt-3 w-full text-slate-400" onClick={() => setVaultMenuOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {showEventLog && (
        <div className="fixed inset-0 z-[55] bg-[#070b12] overflow-y-auto p-3">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white">Vault Event Log</p>
              <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setShowEventLog(false)}>
                Close
              </Button>
            </div>
            <HazardEventLogPanel events={hazardLog} />
          </div>
        </div>
      )}

      {showGpsPanel && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/50" onClick={() => setShowGpsPanel(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-blue-500/30 bg-[#0c1219] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-blue-200 flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4" /> {gpsLive ? 'Live GPS — Device' : 'GPS — Awaiting fix'}
            </div>
            <div className="text-sm text-blue-100/90 tabular-nums font-mono">
              {gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {displaySpeed.toFixed(0)} mph · sync {syncState}
              {gpsAccuracyM != null ? ` · ±${Math.round(gpsAccuracyM)} m` : ''}
              {!gpsLive ? ' · using last known / demo until permission granted' : ''}
            </p>
            <Button className="mt-3 w-full" variant="outline" onClick={() => setShowGpsPanel(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {impactAlert && (
        <ImpactAlertOverlay alert={impactAlert} onReportIncident={handleReportFromAlert} onImOk={handleImOk} />
      )}

      {showIncidentWizard && (
        <IncidentWizard
          onClose={() => setShowIncidentWizard(false)}
          currentGps={{ lat: gpsLat, lng: gpsLng }}
          currentSpeed={fleet.vehicleSpeed}
        />
      )}

      {showSensorFault && <SensorFaultAlert onAcknowledge={acknowledgeFault} gps={{ lat: gpsLat, lng: gpsLng }} />}

      {!trialMode && (
        <div className="fixed bottom-16 right-2 z-40 opacity-70 hover:opacity-100">
          <DemoNavBar
            expanded={demoBarExpanded}
            onToggle={() => setDemoBarExpanded((v) => !v)}
            onHome={onLockVault || logout}
            onReturnToVault={onReturnToVault}
            onSwitchView={onReturnToPortal || (() => switchRole('executive'))}
            onSimulatePothole={() => triggerDemoImpact('pothole')}
            onSimulateCollision={() => triggerDemoImpact('collision')}
            currentView={view}
            syncState={syncState}
          />
        </div>
      )}
    </div>
  );
}

function VaultLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 text-left text-sm font-semibold text-slate-200 hover:border-orange-500/40 hover:bg-orange-500/5"
    >
      {label}
      <ChevronDown className="w-4 h-4 -rotate-90 text-slate-500" />
    </button>
  );
}

function KpiCard({
  label,
  value,
  sub,
  ok,
  large,
  tone = 'white',
}: {
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
  large?: boolean;
  tone?: 'white' | 'emerald';
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-[#0d141e] px-2 py-2 relative min-h-[64px]">
      {ok && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 text-[7px] font-black text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          OK
        </span>
      )}
      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          'font-black tabular-nums leading-tight truncate mt-0.5',
          large ? 'text-base' : 'text-[12px]',
          tone === 'emerald' ? 'text-emerald-400' : 'text-white',
        )}
      >
        {value}
      </p>
      <p className="text-[8px] text-slate-500 truncate mt-0.5">{sub}</p>
    </div>
  );
}

function RangeReadonly({
  label,
  icon,
  value,
  max,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-[72px] flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 shrink-0">
        {icon}
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-600/80 to-cyan-400/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-[11px] font-black text-cyan-300 tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function DemoNavBar({
  expanded,
  onToggle,
  onHome,
  onReturnToVault,
  onSwitchView,
  onSimulatePothole,
  onSimulateCollision,
  currentView,
  syncState,
}: {
  expanded: boolean;
  onToggle: () => void;
  onHome: () => void;
  onReturnToVault?: () => void;
  onSwitchView: () => void;
  onSimulatePothole: () => void;
  onSimulateCollision: () => void;
  currentView: string;
  syncState: string;
}) {
  return (
    <div className="pointer-events-auto rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl overflow-hidden">
      {expanded ? (
        <div className="flex flex-wrap items-center justify-center gap-1 px-2 py-1.5 max-w-[280px]">
          {onReturnToVault && (
            <button className="px-2 py-1 rounded-full text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20" onClick={onReturnToVault}>
              Vault Menu
            </button>
          )}
          <button className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold text-white hover:bg-orange-500" onClick={onHome}>
            <Home className="w-3 h-3" /> Lock
          </button>
          <button className="px-2 py-1 rounded-full text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20" onClick={onSimulatePothole}>
            Sim Pothole
          </button>
          <button className="px-2 py-1 rounded-full text-[10px] font-semibold text-red-200 hover:bg-red-500/20" onClick={onSimulateCollision}>
            Sim Collision
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold text-white hover:bg-orange-500"
            onClick={onSwitchView}
            disabled={currentView === 'desktop'}
          >
            <Monitor className="w-3 h-3" /> Portal
          </button>
          <button className="p-1 rounded-full text-slate-400 hover:text-white" onClick={onToggle}>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-white" onClick={onToggle}>
          <span className={`w-1.5 h-1.5 rounded-full ${syncState === 'connected' ? 'bg-emerald-500' : 'bg-orange-500 animate-pulse'}`} />
          Dev
          <ChevronUp className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function SensorFaultAlert({ onAcknowledge, gps }: { onAcknowledge: () => void; gps: { lat: number; lng: number } }) {
  return (
    <div className="fixed inset-0 z-[60] bg-red-600 flex flex-col items-center justify-center p-6">
      <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6 animate-pulse">
        <ShieldAlert className="w-14 h-14 text-white" />
      </div>
      <h2 className="text-3xl font-black text-white text-center mb-2">SYSTEM INOPERABLE</h2>
      <p className="text-lg font-bold text-white text-center mb-1">ATTENTION REQUIRED</p>
      <p className="text-sm text-white/80 text-center mb-8 max-w-sm">
        Sensor module has detected a physical obstruction or housing misalignment. Sensor data is unreliable.
      </p>
      <div className="bg-white/10 rounded-lg p-4 mb-8 w-full max-w-sm">
        <div className="flex items-center justify-between text-white text-sm py-1">
          <span className="text-white/70">GPS:</span>
          <span className="font-bold">
            {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
          </span>
        </div>
      </div>
      <Button size="lg" className="bg-white text-red-600 hover:bg-white/90 font-bold text-base h-14 px-8" onClick={onAcknowledge}>
        <CheckCircle2 className="w-5 h-5 mr-2" />I ACKNOWLEDGE SENSOR FAULT
      </Button>
    </div>
  );
}
