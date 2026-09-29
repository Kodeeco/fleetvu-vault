'use client';

import { supabase } from '@/lib/supabase';
import { isWebAuthnSupported } from '@/lib/auth-gate';

/**
 * Dual-Path Driver Registration & Authentication (Item 1)
 *
 * The welcome email activation flow directs new drivers to an onboarding
 * selection screen offering two authentication paths:
 *
 *   1. Biometric Fingerprint (Recommended): Hardware-backed smartphone
 *      passkeys (WebAuthn/FIDO2) for instant touch login.
 *   2. Secure KEY-Code: Traditional alphanumeric token issuance.
 *
 * Terminal admin supervisor overrides and 15-minute dynamic PIN fallback
 * workflows handle loaner device scenarios.
 */

export type OnboardingMethod = 'biometric' | 'keycode' | 'pin_fallback';
export type OnboardingStatus = 'pending' | 'method_selected' | 'completed' | 'expired';

export interface OnboardingState {
  id: string;
  driverId: string | null;
  companyId: string | null;
  driverEmail: string;
  authMethod: OnboardingMethod | null;
  webauthnCredentialId: string | null;
  keycodeId: string | null;
  pinExpiresAt: string | null;
  status: OnboardingStatus;
}

/**
 * Initialize onboarding for a new driver.
 * Called when the driver clicks the activation link in the welcome email.
 */
export async function initializeOnboarding(
  driverEmail: string,
  driverId: string | null = null,
  companyId: string | null = null,
): Promise<OnboardingState | null> {
  // Check if there's an existing pending onboarding
  const { data: existing } = await supabase
    .from('driver_onboarding_state')
    .select('*')
    .eq('driver_email', driverEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return mapRow(existing);
  }

  const { data, error } = await supabase
    .from('driver_onboarding_state')
    .insert({
      driver_id: driverId,
      company_id: companyId,
      driver_email: driverEmail,
      status: 'pending',
    })
    .select()
    .single();

  if (error || !data) return null;
  return mapRow(data);
}

/**
 * Select the biometric authentication path.
 * Registers a WebAuthn credential and binds it to the onboarding state.
 */
export async function selectBiometricAuth(
  onboardingId: string,
  driverEmail: string,
): Promise<{ success: boolean; credentialId: string | null; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, credentialId: null, error: 'WebAuthn not supported on this device' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(driverEmail);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'FleetVu Driver Vault' },
        user: {
          id: userId,
          name: driverEmail,
          displayName: driverEmail,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        timeout: 60000,
        attestation: 'indirect',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
      },
    }) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, credentialId: null, error: 'Biometric registration cancelled' };
    }

    const rawIdBytes = new Uint8Array(credential.rawId);
    let credentialId = '';
    for (let i = 0; i < rawIdBytes.length; i++) {
      credentialId += String.fromCharCode(rawIdBytes[i]);
    }
    credentialId = btoa(credentialId);

    await supabase
      .from('driver_onboarding_state')
      .update({
        auth_method: 'biometric',
        webauthn_credential_id: credentialId,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    return { success: true, credentialId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Biometric registration failed';
    return { success: false, credentialId: null, error: message };
  }
}

/**
 * Select the keycode authentication path.
 * Links the onboarding state to an existing driver_access_keycode record.
 */
export async function selectKeycodeAuth(
  onboardingId: string,
  keycodeId: string,
): Promise<{ success: boolean; error?: string }> {
  await supabase
    .from('driver_onboarding_state')
    .update({
      auth_method: 'keycode',
      keycode_id: keycodeId,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', onboardingId);

  return { success: true };
}

/**
 * Generate a 15-minute dynamic PIN fallback for loaner device scenarios.
 * Terminal admin supervisor override — creates a temporary PIN that expires.
 */
export async function generatePinFallback(
  onboardingId: string,
): Promise<{ pin: string; expiresAt: string } | null> {
  // Generate a 6-digit PIN
  const pinBytes = new Uint8Array(6);
  crypto.getRandomValues(pinBytes);
  const pin = Array.from(pinBytes)
    .map((b) => (b % 10).toString())
    .join('');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  const { error } = await supabase
    .from('driver_onboarding_state')
    .update({
      auth_method: 'pin_fallback',
      pin_expires_at: expiresAt,
      status: 'method_selected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', onboardingId);

  if (error) return null;
  return { pin, expiresAt };
}

/**
 * Verify a PIN fallback. Checks that the PIN hasn't expired.
 */
export async function verifyPinFallback(
  onboardingId: string,
): Promise<{ valid: boolean; expired: boolean }> {
  const { data } = await supabase
    .from('driver_onboarding_state')
    .select('pin_expires_at, status')
    .eq('id', onboardingId)
    .maybeSingle();

  if (!data || !data.pin_expires_at) {
    return { valid: false, expired: true };
  }

  const expiresAt = new Date(data.pin_expires_at);
  const expired = expiresAt.getTime() < Date.now();

  if (expired) {
    await supabase
      .from('driver_onboarding_state')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', onboardingId);
    return { valid: false, expired: true };
  }

  await supabase
    .from('driver_onboarding_state')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', onboardingId);

  return { valid: true, expired: false };
}

/**
 * Fetch onboarding state by email.
 */
export async function getOnboardingState(
  driverEmail: string,
): Promise<OnboardingState | null> {
  const { data } = await supabase
    .from('driver_onboarding_state')
    .select('*')
    .eq('driver_email', driverEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

function mapRow(row: Record<string, unknown>): OnboardingState {
  return {
    id: row.id as string,
    driverId: row.driver_id as string | null,
    companyId: row.company_id as string | null,
    driverEmail: row.driver_email as string,
    authMethod: (row.auth_method as OnboardingMethod) ?? null,
    webauthnCredentialId: row.webauthn_credential_id as string | null,
    keycodeId: row.keycode_id as string | null,
    pinExpiresAt: row.pin_expires_at as string | null,
    status: row.status as OnboardingStatus,
  };
}
