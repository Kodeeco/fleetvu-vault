'use client';

import { supabase } from '@/lib/supabase';

/**
 * Zone Hazard Detection System
 *
 * When the tripartite radar channels detect an obstruction in their active
 * zones, a hazard icon (pedestrian, small car, vehicle, or generic hazard)
 * pops up at the detected position on the radar display for ~5 seconds,
 * then fades and falls into the event log with full reporting details.
 */

export type HazardType = 'pedestrian' | 'small_car' | 'vehicle' | 'cyclist' | 'generic';
export type HazardZone = 'forward' | 'left' | 'right';

export interface HazardDetection {
  id: string;
  type: HazardType;
  zone: HazardZone;
  distanceM: number;
  angleDeg: number;
  speedMph: number;
  latitude: number | null;
  longitude: number | null;
  detectedAt: string;
  expiresAt: string;
  logged: boolean;
}

export interface HazardEventLog {
  id: string;
  type: HazardType;
  zone: HazardZone;
  distanceM: number;
  angleDeg: number;
  speedMph: number;
  latitude: number | null;
  longitude: number | null;
  detectedAt: string;
  clearedAt: string;
  durationSec: number;
}

const DISPLAY_DURATION_MS = 5000;

/**
 * Classify a detected object into a hazard type based on radar signature.
 * In production, this uses micro-Doppler analysis from the 77GHz sensor.
 * For now, it uses distance + channel pattern heuristics.
 */
export function classifyHazardType(
  distanceM: number,
  zone: HazardZone,
  radarCrossSection?: number,
): HazardType {
  // Pedestrian: small RCS, typically < 2m, close-range detection
  if (distanceM < 2.0 && (radarCrossSection === undefined || radarCrossSection < 0.5)) {
    return 'pedestrian';
  }

  // Cyclist: small RCS, slightly further
  if (distanceM < 3.0 && (radarCrossSection === undefined || radarCrossSection < 0.8)) {
    return 'cyclist';
  }

  // Small car: medium RCS, forward zone typically
  if (zone === 'forward' && distanceM < 5.0) {
    return 'small_car';
  }

  // Vehicle: larger RCS or further distance
  if (distanceM >= 5.0 || (radarCrossSection !== undefined && radarCrossSection > 1.5)) {
    return 'vehicle';
  }

  return 'generic';
}

/**
 * Create a hazard detection from raw sensor data.
 */
export function createHazardDetection(
  zone: HazardZone,
  distanceM: number,
  angleDeg: number,
  speedMph: number,
  gps: { lat: number; lng: number } | null,
  type?: HazardType,
): HazardDetection {
  const now = Date.now();
  const hazardType = type ?? classifyHazardType(distanceM, zone);

  return {
    id: `hazard-${now}-${Math.random().toString(36).substring(2, 8)}`,
    type: hazardType,
    zone,
    distanceM,
    angleDeg,
    speedMph,
    latitude: gps?.lat ?? null,
    longitude: gps?.lng ?? null,
    detectedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DISPLAY_DURATION_MS).toISOString(),
    logged: false,
  };
}

/**
 * Check if a hazard detection has expired (should be removed from display).
 */
export function isHazardExpired(hazard: HazardDetection, now: number = Date.now()): boolean {
  return new Date(hazard.expiresAt).getTime() <= now;
}

/**
 * Convert a hazard to a permanent event log entry.
 */
export function hazardToEventLog(hazard: HazardDetection): HazardEventLog {
  const clearedAt = new Date().toISOString();
  const durationSec = (Date.now() - new Date(hazard.detectedAt).getTime()) / 1000;

  return {
    id: hazard.id,
    type: hazard.type,
    zone: hazard.zone,
    distanceM: hazard.distanceM,
    angleDeg: hazard.angleDeg,
    speedMph: hazard.speedMph,
    latitude: hazard.latitude,
    longitude: hazard.longitude,
    detectedAt: hazard.detectedAt,
    clearedAt,
    durationSec: Math.min(durationSec, DISPLAY_DURATION_MS / 1000),
  };
}

/**
 * Persist a hazard event to the collision_events table for audit trail.
 */
export async function persistHazardEvent(
  hazard: HazardDetection,
  vehicleId: string | null,
  driverId: string | null,
  companyId: string | null,
): Promise<void> {
  await supabase.from('collision_events').insert({
    vehicle_id: vehicleId,
    driver_id: driverId,
    company_id: companyId,
    event_type: 'proximity_near_miss',
    severity: hazard.distanceM < 1.0 ? 'critical' : hazard.distanceM < 2.0 ? 'high' : 'medium',
    channel_forward_reading: hazard.zone === 'forward' ? hazard.distanceM : null,
    channel_left_reading: hazard.zone === 'left' ? hazard.distanceM : null,
    channel_right_reading: hazard.zone === 'right' ? hazard.distanceM : null,
    impact_speed_mph: hazard.speedMph,
    latitude: hazard.latitude,
    longitude: hazard.longitude,
    metadata: {
      hazard_type: hazard.type,
      angle_deg: hazard.angleDeg,
      display_duration_ms: DISPLAY_DURATION_MS,
    },
    utc_timestamp: hazard.detectedAt,
  });
}

/**
 * Get the SVG position for a hazard on the radar canvas.
 * Maps zone + distance + angle to x/y coordinates in the 1000x1300 viewBox.
 */
export function hazardToSvgPos(
  hazard: HazardDetection,
  bumperX: number,
  bumperY: number,
  pxPerM: number,
  vehicleHalfW: number,
): { x: number; y: number } {
  const radius = vehicleHalfW + hazard.distanceM * pxPerM;
  const rad = ((hazard.angleDeg - 90) * Math.PI) / 180;
  return {
    x: bumperX + radius * Math.cos(rad),
    y: bumperY + radius * Math.sin(rad),
  };
}

/**
 * Get the icon label for a hazard type.
 */
export function hazardIconLabel(type: HazardType): string {
  switch (type) {
    case 'pedestrian': return 'PEDESTRIAN';
    case 'small_car': return 'SMALL CAR';
    case 'vehicle': return 'VEHICLE';
    case 'cyclist': return 'CYCLIST';
    case 'generic': return 'HAZARD';
  }
}

/**
 * Get the color for a hazard type.
 */
export function hazardColor(type: HazardType): string {
  switch (type) {
    case 'pedestrian': return '#EF4444'; // red
    case 'small_car': return '#F59E0B'; // amber
    case 'vehicle': return '#F97316'; // orange
    case 'cyclist': return '#EAB308'; // yellow
    case 'generic': return '#6B7280'; // gray
  }
}

export { DISPLAY_DURATION_MS };
