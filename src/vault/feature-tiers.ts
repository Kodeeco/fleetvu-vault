// ============================================================
// FleetVu Forensic Vault — Feature-Tiering Middleware
// Authorization guards that verify active subscription states.
// Enterprise forensic features lock down gracefully on expiry
// while basic operational logs remain functional.
// ============================================================

import { supabase } from '@/lib/supabase';
import { verifyLicense } from './licensing';
import type {
  VaultFeature,
  VaultFeatureAccessResult,
  VaultFeatureGate,
  VaultTier,
} from './types';

/**
 * Tier → feature capability matrix.
 * Defines which features are available at each subscription tier.
 */
const TIER_MATRIX: Record<VaultTier, Record<VaultFeature, boolean>> = {
  basic: {
    forensic_vault: false,
    collision_reconstruction: false,
    insurance_modeling: false,
    pdf_export: true, // unencrypted / unsealed PDFs remain after Vault LOCK
    live_gps: true,
    historical_reports: false,
  },
  pro: {
    forensic_vault: false,
    collision_reconstruction: false,
    insurance_modeling: false,
    pdf_export: true,
    live_gps: true,
    historical_reports: true,
  },
  proplus: {
    forensic_vault: true,
    collision_reconstruction: true,
    insurance_modeling: true,
    pdf_export: true,
    live_gps: true,
    historical_reports: true,
  },
};

/** Grace period after license expiry before hard lockdown (7 days). */
const GRACE_PERIOD_DAYS = 7;

/**
 * Fetch the feature gate for a company, creating one if it doesn't exist.
 */
export async function getFeatureGate(
  companyId: string,
): Promise<VaultFeatureGate | null> {
  const { data } = await supabase
    .from('vault_feature_gates')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  return data as VaultFeatureGate | null;
}

/**
 * Evaluate and sync the feature gate for a company based on its
 * current license status. This is the core reconciliation function.
 *
 * - If license is active: unlock features per tier matrix
 * - If license is expired: enter grace period, then hard-lock enterprise features
 * - Basic operational features (live_gps) remain functional even when locked down
 */
export async function evaluateFeatureGate(
  companyId: string,
  hardwareSerial?: string,
): Promise<VaultFeatureGate | null> {
  let tier: VaultTier = 'proplus';
  let licenseValid = true;
  let unboundHardware = !hardwareSerial;

  if (hardwareSerial) {
    const verification = await verifyLicense(hardwareSerial);
    // Unbound serial (no vault_licenses row) = Vault OPEN complimentary — not expired.
    // Only a real expired/revoked/suspended license locks forensic features.
    unboundHardware =
      !verification.valid &&
      !!verification.error &&
      /no license bound/i.test(verification.error);

    if (unboundHardware) {
      tier = 'proplus';
      licenseValid = true;
    } else {
      tier = verification.tier;
      licenseValid = verification.valid;
    }
  }

  const now = new Date();
  const tierCaps = TIER_MATRIX[tier];

  let lockedDown = false;
  let gracePeriodUntil: string | null = null;

  if (!licenseValid && !unboundHardware) {
    // License expired — set grace period window
    gracePeriodUntil = new Date(
      now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // If we're past grace period, hard-lock enterprise features
    const existing = await getFeatureGate(companyId);
    if (existing?.grace_period_until) {
      const graceEnd = new Date(existing.grace_period_until);
      if (now > graceEnd) {
        lockedDown = true;
      }
    } else {
      // First evaluation after expiry — grace period starts now
      lockedDown = false;
    }
  }

  const gateData = {
    company_id: companyId,
    tier,
    forensic_vault_enabled: licenseValid && !lockedDown && tierCaps.forensic_vault,
    collision_reconstruction_enabled: licenseValid && !lockedDown && tierCaps.collision_reconstruction,
    insurance_modeling_enabled: licenseValid && !lockedDown && tierCaps.insurance_modeling,
    pdf_export_enabled: true, // basic PDFs always remain; SHA-256 seal is forensic-gated separately
    live_gps_enabled: tierCaps.live_gps, // Always available — basic operational
    historical_reports_enabled: licenseValid && !lockedDown && tierCaps.historical_reports,
    grace_period_until: gracePeriodUntil,
    locked_down: lockedDown,
    last_evaluated_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Upsert the gate record
  const { data: existing } = await supabase
    .from('vault_feature_gates')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    const { data } = await supabase
      .from('vault_feature_gates')
      .update(gateData)
      .eq('id', existing.id)
      .select()
      .single();
    return data as VaultFeatureGate | null;
  }

  const { data: created } = await supabase
    .from('vault_feature_gates')
    .insert(gateData)
    .select()
    .single();
  return created as VaultFeatureGate | null;
}

/**
 * Check whether a specific feature is accessible for a company.
 * This is the guard function called by UI and API layers before
 * granting access to tiered features.
 *
 * @param companyId - The company requesting access
 * @param feature - The feature being requested
 * @param hardwareSerial - Optional hardware serial for license verification
 * @returns Access result with reason if denied
 */
export async function checkFeatureAccess(
  companyId: string,
  feature: VaultFeature,
  hardwareSerial?: string,
): Promise<VaultFeatureAccessResult> {
  let gate = await getFeatureGate(companyId);

  // Re-evaluate when missing, or when a hardware serial is supplied (keeps gate in sync with license).
  if (!gate || hardwareSerial) {
    gate = await evaluateFeatureGate(companyId, hardwareSerial);
  }

  if (!gate) {
    // Soft-open: unbound / uninitialized companies keep forensic modules available (Vault OPEN).
    return {
      allowed: true,
      feature,
      tier: 'proplus',
      locked_down: false,
      in_grace_period: false,
      reason: null,
    };
  }

  // Check the specific feature flag
  const featureFlagMap: Record<VaultFeature, boolean> = {
    forensic_vault: gate.forensic_vault_enabled,
    collision_reconstruction: gate.collision_reconstruction_enabled,
    insurance_modeling: gate.insurance_modeling_enabled,
    pdf_export: gate.pdf_export_enabled,
    live_gps: gate.live_gps_enabled,
    historical_reports: gate.historical_reports_enabled,
  };

  const enabled = featureFlagMap[feature];

  // Live GPS is a basic operational feature — always allowed
  if (feature === 'live_gps') {
    return {
      allowed: true,
      feature,
      tier: gate.tier,
      locked_down: gate.locked_down,
      in_grace_period: !!gate.grace_period_until && new Date(gate.grace_period_until) > new Date(),
      reason: null,
    };
  }

  if (!enabled) {
    const inGrace = !!gate.grace_period_until && new Date(gate.grace_period_until) > new Date();
    return {
      allowed: false,
      feature,
      tier: gate.tier,
      locked_down: gate.locked_down,
      in_grace_period: inGrace,
      reason: gate.locked_down
        ? `Feature '${feature}' is locked down — license expired and grace period ended`
        : `Feature '${feature}' is not available on the '${gate.tier}' tier`,
    };
  }

  return {
    allowed: true,
    feature,
    tier: gate.tier,
    locked_down: false,
    in_grace_period: !!gate.grace_period_until && new Date(gate.grace_period_until) > new Date(),
    reason: null,
  };
}

/**
 * Get all feature flags for a company as a simple boolean map.
 * Convenience function for UI rendering.
 */
export async function getFeatureFlags(
  companyId: string,
): Promise<Record<VaultFeature, boolean>> {
  const gate = await getFeatureGate(companyId);
  if (!gate) {
    return { ...TIER_MATRIX.basic };
  }
  return {
    forensic_vault: gate.forensic_vault_enabled,
    collision_reconstruction: gate.collision_reconstruction_enabled,
    insurance_modeling: gate.insurance_modeling_enabled,
    pdf_export: gate.pdf_export_enabled,
    live_gps: gate.live_gps_enabled,
    historical_reports: gate.historical_reports_enabled,
  };
}
