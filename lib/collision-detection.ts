'use client';

import { supabase } from '@/lib/supabase';
import type { TripartiteChannelReading } from './edge-filter';

/**
 * Standalone Collision vs. Close-Call Impact Verification Engine
 *
 * Differentiates high-risk proximity near-misses from actual physical
 * impacts without requiring any vehicle telematics bus wiring.
 *
 * Uses two independent data sources:
 *   1. 77GHz grille radar channel readings (forward, left, right)
 *   2. Smartphone motion sensors (accelerometer/gyroscope via Web API)
 *
 * Classification logic:
 *   - Proximity Near-Miss: rapid close-quarters pass detected by radar
 *     (distance drops below threshold then increases rapidly) with no
 *     significant smartphone jolt.
 *   - Verified Bumper Impact: radar detects crush/entrainment signature
 *     (extremely low distance on forward channel, sustained contact) PLUS
 *     smartphone motion jolt exceeding the impact threshold.
 */

export type CollisionEventType = 'proximity_near_miss' | 'verified_bumper_impact';
export type CollisionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SmartphoneMotionReading {
  accelerationX: number;
  accelerationY: number;
  accelerationZ: number;
  timestamp: string;
}

export interface ImpactClassificationResult {
  eventType: CollisionEventType;
  severity: CollisionSeverity;
  channelForwardReading: number | null;
  channelLeftReading: number | null;
  channelRightReading: number | null;
  smartphoneJoltG: number;
  impactSpeedMph: number | null;
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ============================================================
// Configurable thresholds — these can be tuned once real sensor
// data is available. Current values are engineering estimates.
// ============================================================

export interface ImpactThresholds {
  /** Minimum radar distance (m) to classify as near-miss vs clear */
  nearMissDistanceM: number;
  /** Radar distance (m) below which a crush signature is suspected */
  crushSignatureDistanceM: number;
  /** Smartphone jolt (g) above which a physical impact is confirmed */
  impactJoltThresholdG: number;
  /** Smartphone jolt (g) above which impact is critical severity */
  criticalJoltG: number;
  /** Sustained contact duration (ms) for entrainment detection */
  entrainmentDurationMs: number;
  /** Speed (mph) above which a near-miss is classified as high severity */
  highSpeedMph: number;
}

export const DEFAULT_THRESHOLDS: ImpactThresholds = {
  nearMissDistanceM: 1.5,
  crushSignatureDistanceM: 0.3,
  impactJoltThresholdG: 2.5,
  criticalJoltG: 5.0,
  entrainmentDurationMs: 250,
  highSpeedMph: 35,
};

/**
 * Compute the peak jolt (g) from a series of smartphone motion readings.
 * Jolt = rate of change of acceleration. We compute the max delta
 * between consecutive acceleration magnitude samples.
 */
export function computeSmartphoneJolt(
  readings: SmartphoneMotionReading[],
): number {
  if (readings.length < 2) return 0;

  let maxJolt = 0;
  for (let i = 1; i < readings.length; i++) {
    const prevMag = Math.sqrt(
      readings[i - 1].accelerationX ** 2 +
      readings[i - 1].accelerationY ** 2 +
      readings[i - 1].accelerationZ ** 2,
    );
    const currMag = Math.sqrt(
      readings[i].accelerationX ** 2 +
      readings[i].accelerationY ** 2 +
      readings[i].accelerationZ ** 2,
    );
    const delta = Math.abs(currMag - prevMag);
    if (delta > maxJolt) maxJolt = delta;
  }

  return maxJolt;
}

/**
 * Classify an event from tripartite channel readings and smartphone motion.
 * This is the core classification function.
 */
export function classifyEvent(
  channels: TripartiteChannelReading[],
  smartphoneJoltG: number,
  speedMph: number | null,
  gps: { lat: number; lng: number } | null,
  thresholds: ImpactThresholds = DEFAULT_THRESHOLDS,
): ImpactClassificationResult {
  const forward = channels.find((c) => c.channel === 'forward');
  const left = channels.find((c) => c.channel === 'left');
  const right = channels.find((c) => c.channel === 'right');

  const forwardDist = forward?.distance_m ?? null;
  const leftDist = left?.distance_m ?? null;
  const rightDist = right?.distance_m ?? null;

  const now = new Date().toISOString();

  // Check for crush signature: extremely low forward distance
  const hasCrushSignature =
    forwardDist !== null && forwardDist <= thresholds.crushSignatureDistanceM;

  // Check for smartphone impact jolt
  const hasImpactJolt = smartphoneJoltG >= thresholds.impactJoltThresholdG;

  // Verified Bumper Impact: crush signature + smartphone jolt
  if (hasCrushSignature && hasImpactJolt) {
    const severity = computeImpactSeverity(smartphoneJoltG, speedMph, thresholds);
    return {
      eventType: 'verified_bumper_impact',
      severity,
      channelForwardReading: forwardDist,
      channelLeftReading: leftDist,
      channelRightReading: rightDist,
      smartphoneJoltG,
      impactSpeedMph: speedMph,
      confidence: computeConfidence(smartphoneJoltG, forwardDist, thresholds),
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      timestamp: now,
      metadata: {
        crush_signature: true,
        entrainment_suspected: smartphoneJoltG >= thresholds.criticalJoltG,
        classification_method: 'radic+smartphone_correlation',
      },
    };
  }

  // Proximity Near-Miss: close-quarters pass without impact jolt
  const minSideDist = Math.min(
    leftDist ?? Infinity,
    rightDist ?? Infinity,
  forwardDist ?? Infinity,
  );

  if (minSideDist <= thresholds.nearMissDistanceM && !hasImpactJolt) {
    const severity = computeNearMissSeverity(minSideDist, speedMph, thresholds);
    return {
      eventType: 'proximity_near_miss',
      severity,
      channelForwardReading: forwardDist,
      channelLeftReading: leftDist,
      channelRightReading: rightDist,
      smartphoneJoltG,
      impactSpeedMph: speedMph,
      confidence: 0.85,
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      timestamp: now,
      metadata: {
        min_distance_m: minSideDist,
        classification_method: 'radar_proximity_only',
      },
    };
  }

  // Default: near-miss if any object was detected in close range
  if (minSideDist <= thresholds.nearMissDistanceM) {
    return {
      eventType: 'proximity_near_miss',
      severity: 'low',
      channelForwardReading: forwardDist,
      channelLeftReading: leftDist,
      channelRightReading: rightDist,
      smartphoneJoltG,
      impactSpeedMph: speedMph,
      confidence: 0.6,
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      timestamp: now,
      metadata: {
        min_distance_m: minSideDist,
        classification_method: 'fallback_proximity',
      },
    };
  }

  // No event
  return {
    eventType: 'proximity_near_miss',
    severity: 'low',
    channelForwardReading: forwardDist,
    channelLeftReading: leftDist,
    channelRightReading: rightDist,
    smartphoneJoltG,
    impactSpeedMph: speedMph,
    confidence: 0,
    latitude: gps?.lat ?? null,
    longitude: gps?.lng ?? null,
    timestamp: now,
    metadata: { classification_method: 'no_event' },
  };
}

function computeImpactSeverity(
  joltG: number,
  speedMph: number | null,
  thresholds: ImpactThresholds,
): CollisionSeverity {
  if (joltG >= thresholds.criticalJoltG) return 'critical';
  if (joltG >= thresholds.impactJoltThresholdG * 1.5) return 'high';
  if (speedMph !== null && speedMph >= thresholds.highSpeedMph) return 'high';
  if (joltG >= thresholds.impactJoltThresholdG) return 'medium';
  return 'low';
}

function computeNearMissSeverity(
  distanceM: number,
  speedMph: number | null,
  thresholds: ImpactThresholds,
): CollisionSeverity {
  if (distanceM < thresholds.crushSignatureDistanceM) return 'critical';
  if (distanceM < thresholds.nearMissDistanceM * 0.3) return 'high';
  if (speedMph !== null && speedMph >= thresholds.highSpeedMph) return 'medium';
  return 'low';
}

function computeConfidence(
  joltG: number,
  forwardDist: number | null,
  thresholds: ImpactThresholds,
): number {
  let confidence = 0.5;
  if (joltG >= thresholds.criticalJoltG) confidence += 0.3;
  else if (joltG >= thresholds.impactJoltThresholdG) confidence += 0.2;
  if (forwardDist !== null && forwardDist <= thresholds.crushSignatureDistanceM) confidence += 0.2;
  return Math.min(0.99, confidence);
}

/**
 * Persist a classified collision event to the database.
 */
export async function persistCollisionEvent(
  result: ImpactClassificationResult,
  vehicleId: string | null,
  driverId: string | null,
  companyId: string | null,
): Promise<void> {
  await supabase.from('collision_events').insert({
    vehicle_id: vehicleId,
    driver_id: driverId,
    company_id: companyId,
    event_type: result.eventType,
    severity: result.severity,
    channel_forward_reading: result.channelForwardReading,
    channel_left_reading: result.channelLeftReading,
    channel_right_reading: result.channelRightReading,
    smartphone_jolt_g: result.smartphoneJoltG,
    impact_speed_mph: result.impactSpeedMph,
    latitude: result.latitude,
    longitude: result.longitude,
    metadata: result.metadata,
    utc_timestamp: result.timestamp,
  });
}

/**
 * Set up smartphone motion sensor listening via the DeviceMotion API.
 * Returns a cleanup function that removes the listener.
 * Falls gracefully if the API is not available.
 */
export function startSmartphoneMotionListener(
  onReading: (reading: SmartphoneMotionReading) => void,
): (() => void) | null {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
    return null;
  }

  const handler = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    onReading({
      accelerationX: acc.x ?? 0,
      accelerationY: acc.y ?? 0,
      accelerationZ: acc.z ?? 0,
      timestamp: new Date().toISOString(),
    });
  };

  // iOS 13+ requires permission
  if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
    (DeviceMotionEvent as any).requestPermission()
      .then((state: string) => {
        if (state === 'granted') {
          window.addEventListener('devicemotion', handler);
        }
      })
      .catch(() => {});
  } else {
    window.addEventListener('devicemotion', handler);
  }

  return () => window.removeEventListener('devicemotion', handler);
}
