'use client';

import { supabase } from '@/lib/supabase';

/**
 * Center-Grille Tripartite Architecture & Adaptive EDGE Pre-Filtering
 *
 * The 77GHz microwave radar is mounted dead-center in the front grille and
 * divided into three dedicated internal channels:
 *   - Channel Forward: monitors the forward projection zone
 *   - Channel Left: monitors the left front bumper zone
 *   - Channel Right: monitors the right front bumper zone
 *
 * Adaptive EDGE Pre-Filtering:
 * When any channel detection zone is configured past the EDGE threshold
 * (default 5m — e.g. Forward 7m on the trial profile), EDGE status arms.
 * Static roadside clutter on Left/Right is suppressed to prevent false-positive
 * log bloat while maintaining 100% capture fidelity for moving dynamic hazards.
 */

export type ChannelId = 'forward' | 'left' | 'right';
export type EdgeStatus = 'active' | 'inactive';

export interface TripartiteChannelReading {
  channel: ChannelId;
  range_m: number;
  distance_m: number | null;
  object_detected: boolean;
  is_static: boolean;
  is_moving: boolean;
  timestamp: string;
}

export interface EdgeFilterResult {
  edgeStatus: EdgeStatus;
  edgeThresholdM: number;
  leftRangeM: number;
  rightRangeM: number;
  edgeActive: boolean;
  filteredReadings: TripartiteChannelReading[];
  suppressedCount: number;
  passedCount: number;
}

export interface SensorChannelConfig {
  channel_forward_range_m: number;
  channel_left_range_m: number;
  channel_right_range_m: number;
  edge_filter_enabled: boolean;
  edge_filter_threshold_m: number;
}

const DEFAULT_CONFIG: SensorChannelConfig = {
  channel_forward_range_m: 7.0,
  channel_left_range_m: 4.0,
  channel_right_range_m: 4.0,
  edge_filter_enabled: true,
  edge_filter_threshold_m: 5.0,
};

/** Spec threshold: any channel configured past this meters → EDGE can arm */
export const EDGE_FILTER_THRESHOLD_M = DEFAULT_CONFIG.edge_filter_threshold_m;

/** FleetVu Mobile trial lock — C55-Pro evaluation defaults */
export const TRIAL_CHANNEL_CONFIG: SensorChannelConfig = {
  channel_forward_range_m: 7.0,
  channel_left_range_m: 4.0,
  channel_right_range_m: 4.0,
  edge_filter_enabled: true,
  edge_filter_threshold_m: 5.0,
};

/**
 * Load the sensor channel configuration for a vehicle from the database.
 * Falls back to defaults if no config exists.
 */
export async function loadChannelConfig(
  vehicleId: string,
): Promise<SensorChannelConfig> {
  const { data } = await supabase
    .from('sensor_channel_config')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .maybeSingle();

  if (!data) return DEFAULT_CONFIG;

  return {
    channel_forward_range_m: Number(data.channel_forward_range_m),
    channel_left_range_m: Number(data.channel_left_range_m),
    channel_right_range_m: Number(data.channel_right_range_m),
    edge_filter_enabled: data.edge_filter_enabled,
    edge_filter_threshold_m: Number(data.edge_filter_threshold_m),
  };
}

/**
 * Save channel configuration for a vehicle.
 */
export async function saveChannelConfig(
  vehicleId: string,
  companyId: string | null,
  config: Partial<SensorChannelConfig>,
): Promise<void> {
  const { data: existing } = await supabase
    .from('sensor_channel_config')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .maybeSingle();

  const payload = {
    vehicle_id: vehicleId,
    company_id: companyId,
    channel_forward_range_m: config.channel_forward_range_m ?? DEFAULT_CONFIG.channel_forward_range_m,
    channel_left_range_m: config.channel_left_range_m ?? DEFAULT_CONFIG.channel_left_range_m,
    channel_right_range_m: config.channel_right_range_m ?? DEFAULT_CONFIG.channel_right_range_m,
    edge_filter_enabled: config.edge_filter_enabled ?? false,
    edge_filter_threshold_m: config.edge_filter_threshold_m ?? DEFAULT_CONFIG.edge_filter_threshold_m,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from('sensor_channel_config')
      .update(payload)
      .eq('id', existing.id);
  } else {
    await supabase
      .from('sensor_channel_config')
      .insert(payload);
  }
}

/**
 * Check if EDGE pre-filtering should be active based on channel ranges.
 * EDGE arms when filtering is enabled and any channel is configured past
 * the threshold (default 5m) — e.g. Forward 7m on the trial profile.
 * Static roadside clutter on Left/Right is then suppressed; moving hazards pass.
 */
export function computeEdgeStatus(config: SensorChannelConfig): EdgeStatus {
  if (!config.edge_filter_enabled) return 'inactive';
  const pastThreshold =
    config.channel_forward_range_m > config.edge_filter_threshold_m ||
    config.channel_left_range_m > config.edge_filter_threshold_m ||
    config.channel_right_range_m > config.edge_filter_threshold_m;
  return pastThreshold ? 'active' : 'inactive';
}

/**
 * Apply EDGE pre-filtering to a set of channel readings.
 * When EDGE is active, static objects detected on the left/right channels
 * (roadside clutter: cones, barriers, guardrails) are suppressed.
 * Moving dynamic hazards always pass through — 100% capture fidelity.
 */
export function applyEdgeFilter(
  readings: TripartiteChannelReading[],
  config: SensorChannelConfig,
): EdgeFilterResult {
  const edgeStatus = computeEdgeStatus(config);
  const edgeActive = edgeStatus === 'active';

  let suppressedCount = 0;
  let passedCount = 0;

  const filteredReadings = readings.map((reading) => {
    // Forward channel always passes — never filter forward detections
    if (reading.channel === 'forward') {
      passedCount++;
      return reading;
    }

    // If EDGE is active, suppress static objects on side channels
    if (edgeActive && reading.is_static && !reading.is_moving) {
      suppressedCount++;
      return { ...reading, object_detected: false };
    }

    passedCount++;
    return reading;
  });

  return {
    edgeStatus,
    edgeThresholdM: config.edge_filter_threshold_m,
    leftRangeM: config.channel_left_range_m,
    rightRangeM: config.channel_right_range_m,
    edgeActive,
    filteredReadings,
    suppressedCount,
    passedCount,
  };
}

/**
 * Parse a raw 77GHz radar frame into tripartite channel readings.
 * The frame format (placeholder until manufacturer protocol docs arrive):
 * Each channel has a distance reading in meters, or null if no object detected.
 * The is_static/is_moving flags come from the radar's micro-Doppler analysis.
 */
export function parseTripartiteFrame(
  forwardDistance: number | null,
  leftDistance: number | null,
  rightDistance: number | null,
  forwardMoving: boolean = false,
  leftMoving: boolean = false,
  rightMoving: boolean = false,
  config?: SensorChannelConfig,
): TripartiteChannelReading[] {
  const now = new Date().toISOString();
  const cfg = config ?? DEFAULT_CONFIG;

  return [
    {
      channel: 'forward',
      range_m: cfg.channel_forward_range_m,
      distance_m: forwardDistance,
      object_detected: forwardDistance !== null,
      is_static: !forwardMoving,
      is_moving: forwardMoving,
      timestamp: now,
    },
    {
      channel: 'left',
      range_m: cfg.channel_left_range_m,
      distance_m: leftDistance,
      object_detected: leftDistance !== null,
      is_static: !leftMoving,
      is_moving: leftMoving,
      timestamp: now,
    },
    {
      channel: 'right',
      range_m: cfg.channel_right_range_m,
      distance_m: rightDistance,
      object_detected: rightDistance !== null,
      is_static: !rightMoving,
      is_moving: rightMoving,
      timestamp: now,
    },
  ];
}
