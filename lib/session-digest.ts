/**
 * Auto-generated shift / session digest for FleetVu Mobile trial.
 * Purely observational — no fault language.
 */

import { shortHash, type VaultEvent } from '@/lib/fleetvu-report';
import type { HazardEventLog } from '@/lib/hazard-detection';
import { EDGE_FILTER_THRESHOLD_M } from '@/lib/edge-filter';

export interface SessionDigestStats {
  sessionStartedAt: string;
  generatedAt: string;
  eventCount: number;
  byZone: { forward: number; left: number; right: number; other: number };
  closestApproachM: number | null;
  closestZone: string | null;
  redZoneCount: number;
  yellowZoneCount: number;
  postPassed: boolean;
  postLastRunAt: string | null;
  syncState: string;
  sealFingerprint: string;
  headline: string;
  bullets: string[];
  edgeActive: boolean;
  edgeThresholdM: number;
  forwardRangeM: number;
  leftRangeM: number;
  rightRangeM: number;
  roadsideSuppressedNote: string;
}

function zoneBucket(zone: string | undefined): keyof SessionDigestStats['byZone'] {
  const z = (zone || '').toLowerCase();
  if (z.includes('forward') || z === 'front' || z === 'fwd') return 'forward';
  if (z.includes('left')) return 'left';
  if (z.includes('right')) return 'right';
  return 'other';
}

export function buildSessionDigest(input: {
  hazardLog: HazardEventLog[];
  postPassed: boolean;
  postLastRunAt: string | null;
  syncState: string;
  truckNumber?: string | null;
  sessionStartedAt: string;
  edgeActive?: boolean;
  forwardRangeM?: number;
  leftRangeM?: number;
  rightRangeM?: number;
  edgeThresholdM?: number;
}): SessionDigestStats {
  const {
    hazardLog,
    postPassed,
    postLastRunAt,
    syncState,
    truckNumber,
    sessionStartedAt,
    edgeActive = true,
    forwardRangeM = 7,
    leftRangeM = 4,
    rightRangeM = 4,
    edgeThresholdM = EDGE_FILTER_THRESHOLD_M,
  } = input;
  const generatedAt = new Date().toISOString();
  const byZone = { forward: 0, left: 0, right: 0, other: 0 };
  let closestApproachM: number | null = null;
  let closestZone: string | null = null;
  let redZoneCount = 0;
  let yellowZoneCount = 0;

  for (const e of hazardLog) {
    const bucket = zoneBucket(e.zone);
    byZone[bucket] += 1;
    if (closestApproachM == null || e.distanceM < closestApproachM) {
      closestApproachM = e.distanceM;
      closestZone = e.zone;
    }
    if (e.distanceM < 0.6) redZoneCount += 1;
    else if (e.distanceM < 2.0) yellowZoneCount += 1;
  }

  const sealFingerprint = shortHash(
    `${sessionStartedAt}|${generatedAt}|${hazardLog.length}|${closestApproachM ?? 'na'}|${truckNumber || ''}|edge:${edgeActive}`,
  );

  const truck = truckNumber || 'unit';
  const headline =
    hazardLog.length === 0
      ? `Shift digest ready — ${truck}: no proximity events logged yet`
      : `Shift digest ready — ${truck}: ${hazardLog.length} proximity event${hazardLog.length === 1 ? '' : 's'} logged`;

  const roadsideSuppressedNote = edgeActive
    ? `EDGE ACTIVE @ ${edgeThresholdM.toFixed(0)}m — static roadside clutter on Left/Right channels suppressed from the event log; moving hazards still captured.`
    : `EDGE STANDBY — roadside suppression not armed (threshold ${edgeThresholdM.toFixed(0)}m).`;

  const bullets: string[] = [];
  bullets.push(`Session window opened ${new Date(sessionStartedAt).toLocaleString()}.`);
  bullets.push(
    `Channel envelope on file: FWD ${forwardRangeM.toFixed(0)}m · LEFT ${leftRangeM.toFixed(0)}m · RIGHT ${rightRangeM.toFixed(0)}m.`,
  );
  bullets.push(
    `Channel hits on file: FWD ${byZone.forward} · LEFT ${byZone.left} · RIGHT ${byZone.right}.`,
  );
  bullets.push(roadsideSuppressedNote);
  if (closestApproachM != null) {
    bullets.push(
      `Closest recorded approach: ${closestApproachM.toFixed(1)} m (${(closestZone || 'zone').toUpperCase()}).`,
    );
  }
  bullets.push(`Proximity ladder counts: RED ${redZoneCount} · YELLOW ${yellowZoneCount}.`);
  bullets.push(
    postPassed
      ? `Daily POST on file${postLastRunAt ? ` (${new Date(postLastRunAt).toLocaleString()})` : ''}.`
      : 'Daily POST not completed for this session.',
  );
  bullets.push(`Sync state: ${syncState}. Seal fingerprint: ${sealFingerprint.toUpperCase()}.`);
  bullets.push('Observational logging only — not a fault or liability determination.');

  return {
    sessionStartedAt,
    generatedAt,
    eventCount: hazardLog.length,
    byZone,
    closestApproachM,
    closestZone,
    redZoneCount,
    yellowZoneCount,
    postPassed,
    postLastRunAt,
    syncState,
    sealFingerprint: sealFingerprint.toUpperCase(),
    headline,
    bullets,
    edgeActive,
    edgeThresholdM,
    forwardRangeM,
    leftRangeM,
    rightRangeM,
    roadsideSuppressedNote,
  };
}

/** Map live hazard log → Forensic Vault obstruction events */
export function hazardLogToVaultEvents(hazardLog: HazardEventLog[]): VaultEvent[] {
  return hazardLog.map((e) => {
    const ts = new Date(e.detectedAt).getTime();
    const critical = e.distanceM < 0.6;
    return {
      id: e.id,
      category: 'obstruction' as const,
      severity: critical ? ('critical' as const) : ('warning' as const),
      time: new Date(e.detectedAt).toLocaleTimeString([], { hour12: false }),
      timestamp: ts,
      title: `PROXIMITY — ${(e.zone || 'zone').toUpperCase()}`,
      detail: `${e.type.replace(/_/g, ' ')} · ${e.distanceM.toFixed(1)} m · ${e.speedMph.toFixed(0)} MPH`,
      hash: shortHash(e.id + e.detectedAt),
      distance: e.distanceM,
      zone: (e.zone || '').toUpperCase(),
    };
  });
}

export function formatDigestPlainText(
  digest: SessionDigestStats,
  meta?: { driver?: string; company?: string; weekly?: boolean },
): string {
  const title = meta?.weekly
    ? 'FleetVu C55-Pro — Weekly SHA-256 Safety Digest'
    : 'FleetVu C55-Pro — Auto Session Digest';
  const lines = [
    title,
    meta?.company ? `Company: ${meta.company}` : '',
    meta?.driver ? `Driver: ${meta.driver}` : '',
    digest.headline,
    '',
    ...digest.bullets.map((b) => `• ${b}`),
    '',
    `Generated: ${new Date(digest.generatedAt).toLocaleString()}`,
    `SHA-256 fingerprint (short): ${digest.sealFingerprint}`,
    digest.edgeActive ? 'EDGE ACTIVE / roadside suppression: ON' : 'EDGE ACTIVE / roadside suppression: OFF',
  ].filter(Boolean);
  return lines.join('\n');
}

/** Build a weekly-style digest body for email (mailto / share). */
export function buildWeeklySafetyDigestEmail(input: {
  digest: SessionDigestStats;
  companyName?: string;
  driverName?: string;
  truckNumber?: string | null;
  toEmail?: string;
}): { subject: string; body: string; mailtoHref: string } {
  const { digest, companyName, driverName, truckNumber, toEmail } = input;
  const subject = `FleetVu Weekly SHA-256 Safety Digest — ${truckNumber || 'unit'} · ${companyName || 'Fleet'}`;
  const body = formatDigestPlainText(digest, {
    company: companyName,
    driver: driverName,
    weekly: true,
  });
  const mailtoHref = `mailto:${encodeURIComponent(toEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, mailtoHref };
}
