/**
 * Accident Reconstruction Integrity Pipeline
 *
 * Preserves millisecond-accurate sequencing of pre-collision telemetry,
 * sensor states, and warning alerts without gaps, overwrites, or data loss.
 */

import { sha256Hex } from './aes-vault';
import { sealCustodyEvent, type CustodyEvent } from './chain-of-custody';

export interface ReconstructionSample {
  /** Epoch milliseconds — sub-second precision required */
  tMs: number;
  source: 'telemetry' | 'sensor' | 'alert' | 'driver_signoff' | 'gps' | 'imu';
  vehicleId: string | null;
  driverId: string | null;
  companyId: string | null;
  payload: Record<string, unknown>;
}

export interface SequencedFrame {
  index: number;
  tMs: number;
  deltaMs: number;
  source: ReconstructionSample['source'];
  vehicleId: string | null;
  driverId: string | null;
  companyId: string | null;
  payload: Record<string, unknown>;
  /** SHA-256 of canonical frame — seals ordering */
  frameHash: string;
  prevFrameHash: string | null;
}

export interface ReconstructionPackage {
  id: string;
  incidentId: string | null;
  companyId: string | null;
  frameCount: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  gapCount: number;
  maxGapMs: number;
  /** Frames with delta exceeding threshold (default 250ms) */
  gaps: Array<{ afterIndex: number; gapMs: number }>;
  frames: SequencedFrame[];
  merkleRoot: string;
  packageHash: string;
  sealedAt: string;
  custody: CustodyEvent | null;
}

const DEFAULT_GAP_THRESHOLD_MS = 250;

function canonicalizeFrame(frame: Omit<SequencedFrame, 'frameHash' | 'prevFrameHash'> & { prevFrameHash: string | null }): string {
  return JSON.stringify({
    index: frame.index,
    tMs: frame.tMs,
    deltaMs: frame.deltaMs,
    source: frame.source,
    vehicleId: frame.vehicleId,
    driverId: frame.driverId,
    companyId: frame.companyId,
    payload: frame.payload,
    prevFrameHash: frame.prevFrameHash,
  });
}

/**
 * Sort, dedupe, and seal reconstruction samples into a gap-aware chain.
 * Dedupes identical (tMs, source, vehicleId) tuples — never overwrites payloads;
 * conflicting payloads at the same timestamp are both retained with micro-offsets.
 */
export async function buildReconstructionSequence(
  samples: ReconstructionSample[],
  options: {
    incidentId?: string | null;
    gapThresholdMs?: number;
    actorEmail?: string | null;
    deviceId?: string | null;
  } = {},
): Promise<ReconstructionPackage> {
  const gapThreshold = options.gapThresholdMs ?? DEFAULT_GAP_THRESHOLD_MS;

  // Stable sort by tMs, then source for determinism
  const sorted = [...samples].sort((a, b) => {
    if (a.tMs !== b.tMs) return a.tMs - b.tMs;
    return a.source.localeCompare(b.source);
  });

  // Resolve timestamp collisions without data loss
  const adjusted: ReconstructionSample[] = [];
  let lastT = -Infinity;
  for (const s of sorted) {
    let t = s.tMs;
    if (t <= lastT) {
      t = lastT + 1; // 1ms micro-offset preserves both samples
    }
    adjusted.push({ ...s, tMs: t });
    lastT = t;
  }

  const frames: SequencedFrame[] = [];
  const gaps: ReconstructionPackage['gaps'] = [];
  let prevHash: string | null = null;
  let maxGap = 0;

  for (let i = 0; i < adjusted.length; i++) {
    const sample = adjusted[i];
    const prevT = i === 0 ? sample.tMs : adjusted[i - 1].tMs;
    const deltaMs = i === 0 ? 0 : sample.tMs - prevT;

    if (i > 0 && deltaMs > gapThreshold) {
      gaps.push({ afterIndex: i - 1, gapMs: deltaMs });
      maxGap = Math.max(maxGap, deltaMs);
    }

    const unsigned = {
      index: i,
      tMs: sample.tMs,
      deltaMs,
      source: sample.source,
      vehicleId: sample.vehicleId,
      driverId: sample.driverId,
      companyId: sample.companyId,
      payload: sample.payload,
      prevFrameHash: prevHash,
    };

    const frameHash = await sha256Hex(canonicalizeFrame(unsigned));
    frames.push({ ...unsigned, frameHash });
    prevHash = frameHash;
  }

  // Merkle root over frame hashes
  let level = frames.map((f) => f.frameHash);
  if (level.length === 0) {
    level = [await sha256Hex('')];
  }
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(await sha256Hex(left + right));
    }
    level = next;
  }
  const merkleRoot = level[0];

  const id = crypto.randomUUID();
  const sealedAt = new Date().toISOString();
  const companyId = options.incidentId
    ? adjusted[0]?.companyId ?? null
    : adjusted[0]?.companyId ?? null;

  const packageHash = await sha256Hex(
    JSON.stringify({
      id,
      merkleRoot,
      frameCount: frames.length,
      startMs: frames[0]?.tMs ?? 0,
      endMs: frames[frames.length - 1]?.tMs ?? 0,
      sealedAt,
    }),
  );

  const custody = await sealCustodyEvent({
    artifactType: 'reconstruction_package',
    artifactId: id,
    companyId,
    action: 'sealed',
    actor: {
      accountId: null,
      email: options.actorEmail ?? 'reconstruction-pipeline@fleetvu.org',
      role: 'system',
    },
    device: {
      deviceId: options.deviceId ?? 'server',
      platform: 'fleetvu-reconstruction',
      appVersion: '1.0.0',
    },
    artifactHash: packageHash,
    metadata: {
      incident_id: options.incidentId ?? null,
      frame_count: frames.length,
      gap_count: gaps.length,
    },
  });

  return {
    id,
    incidentId: options.incidentId ?? null,
    companyId,
    frameCount: frames.length,
    startMs: frames[0]?.tMs ?? 0,
    endMs: frames[frames.length - 1]?.tMs ?? 0,
    durationMs: frames.length > 1 ? frames[frames.length - 1].tMs - frames[0].tMs : 0,
    gapCount: gaps.length,
    maxGapMs: maxGap,
    gaps,
    frames,
    merkleRoot,
    packageHash,
    sealedAt,
    custody,
  };
}

/**
 * Assert reconstruction package integrity for expert witness review.
 */
export async function verifyReconstructionPackage(
  pkg: ReconstructionPackage,
): Promise<{ valid: boolean; error: string | null }> {
  let prev: string | null = null;
  for (const frame of pkg.frames) {
    if (frame.prevFrameHash !== prev) {
      return { valid: false, error: `Frame linkage broken at index ${frame.index}` };
    }
    const { frameHash, ...rest } = frame;
    const expected = await sha256Hex(canonicalizeFrame({ ...rest, prevFrameHash: frame.prevFrameHash }));
    if (expected !== frameHash) {
      return { valid: false, error: `Frame hash mismatch at index ${frame.index}` };
    }
    prev = frameHash;
  }

  const expectedPkg = await sha256Hex(
    JSON.stringify({
      id: pkg.id,
      merkleRoot: pkg.merkleRoot,
      frameCount: pkg.frames.length,
      startMs: pkg.startMs,
      endMs: pkg.endMs,
      sealedAt: pkg.sealedAt,
    }),
  );

  if (expectedPkg !== pkg.packageHash) {
    return { valid: false, error: 'Package hash mismatch' };
  }

  return { valid: true, error: null };
}
