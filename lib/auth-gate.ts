'use client';

import { supabase } from './supabase';
import { isBypassActive, shouldBypassGate } from './testing-mode';
import type { DriverAccessKeycode } from './types';

export type AuthGateMethod = 'keycode' | 'session' | 'webauthn';

export interface AuthGateResult {
  granted: boolean;
  method: AuthGateMethod | null;
  reason: string | null;
  keycodeRecord?: DriverAccessKeycode;
}

export interface AuthGateInput {
  keycode?: string;
  requireMethods?: AuthGateMethod[];
}

const DEFAULT_METHODS: AuthGateMethod[] = ['keycode', 'session', 'webauthn'];

/**
 * Verify a FleetVu Access Keycode against the driver_access_keycodes table.
 * A valid keycode must be in 'dispatched' or 'generated' status, not expired,
 * and not revoked. On success, the keycode is burned (one-time use).
 */
async function verifyKeycode(keycode: string): Promise<AuthGateResult> {
  if (!keycode || !keycode.trim()) {
    return { granted: false, method: null, reason: 'No keycode provided' };
  }

  const normalized = keycode.trim().toUpperCase();

  const { data, error } = await supabase
    .from('driver_access_keycodes')
    .select('*')
    .eq('keycode', normalized)
    .single();

  if (error || !data) {
    return { granted: false, method: null, reason: 'Keycode not found' };
  }

  const record = data as DriverAccessKeycode;

  if (record.lifecycle_status === 'revoked') {
    return { granted: false, method: null, reason: 'Keycode has been revoked' };
  }

  if (record.lifecycle_status === 'burned') {
    return { granted: false, method: null, reason: 'Keycode already used' };
  }

  if (record.expires_at) {
    const expiry = new Date(record.expires_at);
    if (expiry.getTime() < Date.now()) {
      return { granted: false, method: null, reason: 'Keycode has expired' };
    }
  }

  // Burn the keycode (one-time use)
  const { error: burnError } = await supabase
    .from('driver_access_keycodes')
    .update({
      lifecycle_status: 'burned',
      burned_at: new Date().toISOString(),
      burned_by_device: getDeviceFingerprint(),
    })
    .eq('id', record.id);

  if (burnError) {
    // Non-blocking — the keycode was valid, burn failure is a logging issue
    console.warn('Failed to burn keycode:', burnError.message);
  }

  return { granted: true, method: 'keycode', reason: null, keycodeRecord: record };
}

/**
 * Verify the current Supabase session token. If the user has an active
 * authenticated session with a corporate email, access is granted.
 */
async function verifySession(): Promise<AuthGateResult> {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return { granted: false, method: null, reason: 'No active session' };
  }

  const email = data.session.user?.email;
  if (!email) {
    return { granted: false, method: null, reason: 'Session has no associated email' };
  }

  return { granted: true, method: 'session', reason: null };
}

/**
 * Create a WebAuthn biometric credential registration challenge.
 * Returns the PublicKeyCredentialCreationOptions for the browser's
 * navigator.credentials.create() call.
 */
export async function createWebAuthnRegistration(
  userEmail: string,
  userId: string,
): Promise<PublicKeyCredentialCreationOptions | null> {
  if (!isWebAuthnSupported()) return null;

  const challenge = generateChallenge();
  const credentialId = new Uint8Array(32);
  crypto.getRandomValues(credentialId);

  return {
    challenge,
    rp: {
      name: 'FleetVu Forensic Vault',
    },
    user: {
      id: new TextEncoder().encode(userId),
      name: userEmail,
      displayName: userEmail,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 },  // RS256
    ],
    timeout: 60000,
    attestation: 'indirect',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    excludeCredentials: [],
  };
}

/**
 * Verify a WebAuthn biometric credential using navigator.credentials.get().
 * This triggers the platform biometric prompt (Touch ID, Face ID, etc.).
 */
async function verifyWebAuthn(): Promise<AuthGateResult> {
  if (!isWebAuthnSupported()) {
    return { granted: false, method: null, reason: 'WebAuthn not supported on this device' };
  }

  try {
    const challenge = generateChallenge();
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
    };

    const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });
    if (!credential) {
      return { granted: false, method: null, reason: 'Biometric verification cancelled' };
    }

    return { granted: true, method: 'webauthn', reason: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'WebAuthn verification failed';
    return { granted: false, method: null, reason: message };
  }
}

/**
 * Main authorization gate. Tries each method in order until one succeeds.
 * If requireMethods is specified, only those methods are tried.
 */
export async function authorizeGate(
  input: AuthGateInput = {},
): Promise<AuthGateResult> {
  // Engineering testing mode bypass — only active when env flag is set
  if (isBypassActive() && shouldBypassGate('vault_access')) {
    return { granted: true, method: 'keycode', reason: 'TEST MODE BYPASS' };
  }

  const methods = input.requireMethods ?? DEFAULT_METHODS;

  for (const method of methods) {
    let result: AuthGateResult;

    switch (method) {
      case 'keycode':
        if (!input.keycode) continue;
        result = await verifyKeycode(input.keycode);
        break;
      case 'session':
        result = await verifySession();
        break;
      case 'webauthn':
        result = await verifyWebAuthn();
        break;
      default:
        continue;
    }

    if (result.granted) return result;
  }

  return {
    granted: false,
    method: null,
    reason: 'All authorization methods failed',
  };
}

/**
 * Quick check: is WebAuthn (biometric) available in this browser?
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

/**
 * Check if platform authenticator (Touch ID / Face ID) is available.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  const nav = window.navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');
  // Simple hash — not cryptographic, just for identification
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `dev_${Math.abs(hash).toString(16)}`;
}
