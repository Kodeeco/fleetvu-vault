'use client';

/**
 * Dedicated Testing Mode — Engineering Override Bypass
 *
 * SECURITY DESIGN:
 * This module provides an engineering bypass for the manufacturer's testing
 * team to run full telemetry and sensor integration tests without restriction.
 *
 * CRITICAL: This bypass is gated by an environment variable that must ONLY
 * be set in development/staging environments. It must NEVER be set in
 * production deployments. The build system should strip this flag in
 * production builds.
 *
 * The bypass is NOT a hardcoded key — it is an env-scoped flag that
 * only exists when the application is running in a test environment.
 */

const TEST_MODE_FLAG = process.env.NEXT_PUBLIC_FLEETVU_TEST_MODE;
const TEST_MODE_KEY = process.env.NEXT_PUBLIC_FLEETVU_TEST_KEY;

export interface TestModeState {
  enabled: boolean;
  bypassActive: boolean;
  reason: string;
}

/**
 * Check if testing mode is enabled at all.
 * This checks the env flag — if not set, testing mode is completely off.
 */
export function isTestModeEnabled(): boolean {
  return TEST_MODE_FLAG === 'true' || TEST_MODE_FLAG === '1';
}

/**
 * Check if the engineering bypass is currently active.
 * Requires both the env flag AND a valid test key to be present.
 */
export function isBypassActive(): boolean {
  if (!isTestModeEnabled()) return false;
  if (!TEST_MODE_KEY || TEST_MODE_KEY.length < 8) return false;
  return true;
}

/**
 * Get the full test mode state for UI display.
 */
export function getTestModeState(): TestModeState {
  if (!isTestModeEnabled()) {
    return { enabled: false, bypassActive: false, reason: 'Test mode not enabled' };
  }
  if (!isBypassActive()) {
    return { enabled: true, bypassActive: false, reason: 'Test mode enabled but key missing' };
  }
  return { enabled: true, bypassActive: true, reason: 'Engineering bypass active' };
}

/**
 * Middleware-style guard: should this request/action be bypassed?
 * In production (no env flag), this always returns false — no bypass possible.
 */
export function shouldBypassGate(gateName: string): boolean {
  if (!isBypassActive()) return false;
  // Log the bypass for audit trail — but only in test mode
  if (typeof window !== 'undefined' && isTestModeEnabled()) {
    console.info(`[TEST MODE] Bypassing gate: ${gateName}`);
  }
  return true;
}

/**
 * Get a list of all gates that the bypass covers.
 * Used for UI display in the engineering panel.
 */
export const BYPASS_GATES = [
  'vault_access',
  'pdf_download',
  'profile_edit',
  'sensor_calibration',
  'telemetry_ingestion',
  'post_check',
] as const;

export type BypassGate = (typeof BYPASS_GATES)[number];
