// ============================================================
// FleetVu Forensic Vault — Hardware Licensing Middleware
// Binds vault access to pre-loaded hardware serial numbers
// and initializes the 12-month complimentary timer on activation.
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  VaultLicense,
  VaultLicenseVerification,
  VaultTier,
} from './types';

/** 12 months in milliseconds (365.25 days for leap-year accuracy). */
const TWELVE_MONTHS_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Generate a license key in the format FV-LIC-XXXXXXXX.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let key = 'FV-LIC-';
  for (let i = 0; i < 8; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key;
}

/**
 * Provision a new hardware-bound license.
 * Called during initial corporate onboarding / tenant provisioning.
 *
 * @param hardwareSerial - Pre-loaded device serial number
 * @param companyId - Owning company ID
 * @param tier - Subscription tier (defaults to 'basic')
 * @returns The created VaultLicense record
 */
export async function provisionLicense(
  hardwareSerial: string,
  companyId: string,
  tier: VaultTier = 'basic',
): Promise<VaultLicense> {
  const licenseKey = generateLicenseKey();

  const { data, error } = await supabase
    .from('vault_licenses')
    .insert({
      company_id: companyId,
      hardware_serial: hardwareSerial,
      license_key: licenseKey,
      tier,
      status: 'pending_activation',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`License provisioning failed: ${error?.message ?? 'unknown error'}`);
  }

  return data as VaultLicense;
}

/**
 * Activate a license on first hardware boot.
 * Sets the 12-month complimentary timer starting from activation time.
 *
 * @param hardwareSerial - The hardware unit's serial number
 * @returns The activated VaultLicense with complimentary_until populated
 */
export async function activateLicense(
  hardwareSerial: string,
): Promise<VaultLicense> {
  const now = new Date();
  const complimentaryUntil = new Date(now.getTime() + TWELVE_MONTHS_MS);

  const { data, error } = await supabase
    .from('vault_licenses')
    .update({
      status: 'active',
      activated_at: now.toISOString(),
      complimentary_until: complimentaryUntil.toISOString(),
      last_verification_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('hardware_serial', hardwareSerial)
    .eq('status', 'pending_activation')
    .select()
    .maybeSingle();

  if (error || !data) {
    // License may already be activated — fetch current state
    const { data: existing } = await supabase
      .from('vault_licenses')
      .select('*')
      .eq('hardware_serial', hardwareSerial)
      .maybeSingle();

    if (!existing) {
      throw new Error(`No license found for hardware serial: ${hardwareSerial}`);
    }
    return existing as VaultLicense;
  }

  return data as VaultLicense;
}

/**
 * Verify a hardware-bound license is active and within its subscription window.
 * Checks both the complimentary period and any paid subscription extension.
 *
 * @param hardwareSerial - The hardware unit's serial number
 * @returns Verification result with remaining complimentary days
 */
export async function verifyLicense(
  hardwareSerial: string,
): Promise<VaultLicenseVerification> {
  const { data, error } = await supabase
    .from('vault_licenses')
    .select('*')
    .eq('hardware_serial', hardwareSerial)
    .maybeSingle();

  if (error || !data) {
    return {
      valid: false,
      status: 'revoked',
      tier: 'basic',
      complimentary_remaining_days: 0,
      error: `No license bound to hardware serial: ${hardwareSerial}`,
    };
  }

  const license = data as VaultLicense;
  const now = new Date();

  // Update last verification timestamp
  await supabase
    .from('vault_licenses')
    .update({ last_verification_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', license.id);

  // Check for explicit suspension or revocation
  if (license.status === 'suspended' || license.status === 'revoked') {
    return {
      valid: false,
      status: license.status,
      tier: license.tier,
      complimentary_remaining_days: 0,
      error: `License is ${license.status}`,
    };
  }

  // Determine the effective expiration date
  const complimentaryEnd = license.complimentary_until
    ? new Date(license.complimentary_until)
    : null;
  const subscriptionEnd = license.subscription_until
    ? new Date(license.subscription_until)
    : null;

  // Use whichever is later — complimentary or paid subscription
  let effectiveEnd: Date | null = null;
  if (complimentaryEnd && subscriptionEnd) {
    effectiveEnd = subscriptionEnd > complimentaryEnd ? subscriptionEnd : complimentaryEnd;
  } else if (subscriptionEnd) {
    effectiveEnd = subscriptionEnd;
  } else if (complimentaryEnd) {
    effectiveEnd = complimentaryEnd;
  }

  if (!effectiveEnd) {
    return {
      valid: false,
      status: 'expired',
      tier: license.tier,
      complimentary_remaining_days: 0,
      error: 'No active subscription period found',
    };
  }

  const remainingMs = effectiveEnd.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

  if (remainingMs <= 0) {
    // Expired — update status
    await supabase
      .from('vault_licenses')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('id', license.id);

    return {
      valid: false,
      status: 'expired',
      tier: license.tier,
      complimentary_remaining_days: 0,
      error: 'License has expired',
    };
  }

  // Calculate complimentary remaining specifically
  const compRemainingMs = complimentaryEnd
    ? complimentaryEnd.getTime() - now.getTime()
    : 0;
  const compRemainingDays = Math.max(0, Math.ceil(compRemainingMs / (24 * 60 * 60 * 1000)));

  return {
    valid: true,
    status: 'active',
    tier: license.tier,
    complimentary_remaining_days: compRemainingDays,
    error: null,
  };
}

/**
 * Extend a license with a paid subscription period.
 * Called when a company upgrades from complimentary to paid.
 *
 * @param hardwareSerial - The hardware unit's serial number
 * @param extensionDays - Number of days to extend
 * @param newTier - Optional tier upgrade
 */
export async function extendSubscription(
  hardwareSerial: string,
  extensionDays: number,
  newTier?: VaultTier,
): Promise<VaultLicense> {
  const { data: license } = await supabase
    .from('vault_licenses')
    .select('*')
    .eq('hardware_serial', hardwareSerial)
    .maybeSingle();

  if (!license) {
    throw new Error(`No license found for hardware serial: ${hardwareSerial}`);
  }

  const now = new Date();
  const currentEnd = license.subscription_until
    ? new Date(license.subscription_until)
    : now;
  const baseDate = currentEnd > now ? currentEnd : now;
  const newSubEnd = new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

  const updates: Record<string, unknown> = {
    subscription_until: newSubEnd.toISOString(),
    status: 'active',
    last_verification_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (newTier) {
    updates.tier = newTier;
  }

  const { data, error } = await supabase
    .from('vault_licenses')
    .update(updates)
    .eq('id', license.id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Subscription extension failed: ${error?.message ?? 'unknown error'}`);
  }

  return data as VaultLicense;
}
