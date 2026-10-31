/**
 * Bound-driver resume + Vault PIN unlock.
 * Keycode binds the phone once; Vault PIN unlocks Home each time the app is opened.
 */

import type { AuthUser } from '@/lib/app-context';

const PROFILE_KEY = 'fleetvu_driver_device_v1';
const BOUND_FLAG = 'fleetvu_biometric_bound';
const PIN_KEY = 'fleetvu_vault_pin_v1';
const SESSION_UNLOCK_KEY = 'fleetvu_vault_session_unlocked';

export function isDriverDeviceBound(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BOUND_FLAG) === '1' || Boolean(localStorage.getItem(PROFILE_KEY));
  } catch {
    return false;
  }
}

export function saveBoundDriverProfile(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  try {
    const slim: AuthUser = {
      ...user,
      role: 'driver',
      biometricBound: true,
      biometricVerified: true,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(slim));
    localStorage.setItem(BOUND_FLAG, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Call BEFORE wiping fleetvu_user on portal hashes — keeps Home resume alive.
 */
export function preserveBoundDriverBeforeSessionWipe(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(PROFILE_KEY)) {
      localStorage.setItem(BOUND_FLAG, '1');
      return;
    }
    const raw = localStorage.getItem('fleetvu_user');
    if (!raw) return;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.role === 'driver' || localStorage.getItem(BOUND_FLAG) === '1') {
      saveBoundDriverProfile({
        ...parsed,
        role: 'driver',
        biometricBound: true,
        biometricVerified: true,
      });
    }
  } catch {
    /* ignore */
  }
}

function stubBoundDriver(): AuthUser {
  return {
    role: 'driver',
    email: 'bound.driver@device.fleetvu',
    name: 'Driver',
    biometricBound: true,
    biometricVerified: true,
    sensorHardware: 'C55-Pro',
    planTier: 'proplus',
  };
}

export function loadBoundDriverProfile(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthUser;
      if (parsed?.email) {
        localStorage.setItem(BOUND_FLAG, '1');
        return {
          ...parsed,
          role: 'driver',
          biometricBound: true,
          biometricVerified: true,
        };
      }
    }
    if (localStorage.getItem(BOUND_FLAG) === '1') {
      const stub = stubBoundDriver();
      saveBoundDriverProfile(stub);
      return stub;
    }
    return null;
  } catch {
    return null;
  }
}

/** Resume Home when this phone already completed keycode + bind. */
export function tryResumeBoundDriver(): AuthUser | null {
  preserveBoundDriverBeforeSessionWipe();
  return loadBoundDriverProfile();
}

/** Wipe phone-local bind + PIN so Legal / keycode onboarding can run again. */
export function clearBoundDriverStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(BOUND_FLAG);
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem('fleetvu_user');
    localStorage.removeItem('fleetvu_fleet');
    localStorage.removeItem('fleetvu_vault_phase');
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    sessionStorage.removeItem('fleetvu_vault_unlock_once');
  } catch {
    /* ignore */
  }
}

/** Lightweight phone-local digest — cab PIN, not a bank vault. */
export function digestVaultPin(pin: string): string {
  const s = `fv-vault-pin-v1:${pin.trim()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `v1:${(h >>> 0).toString(16)}`;
}

export function hasVaultPin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(PIN_KEY));
  } catch {
    return false;
  }
}

export function setVaultPin(pin: string): boolean {
  if (typeof window === 'undefined') return false;
  const cleaned = pin.replace(/\D/g, '');
  if (cleaned.length < 4 || cleaned.length > 6) return false;
  try {
    localStorage.setItem(PIN_KEY, digestVaultPin(cleaned));
    unlockVaultSession();
    return true;
  } catch {
    return false;
  }
}

export function verifyVaultPin(pin: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;
    return stored === digestVaultPin(pin.replace(/\D/g, ''));
  } catch {
    return false;
  }
}

/** Session unlock — cleared when the browser/app fully closes (sessionStorage). */
export function isVaultSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockVaultSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_UNLOCK_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function lockVaultSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

/** True when real drivers must unlock before Home content. */
export function needsVaultUnlock(opts?: { previewMode?: boolean }): boolean {
  if (typeof window === 'undefined') return false;
  if (opts?.previewMode) return false;
  if (!isDriverDeviceBound()) return false;
  if (isVaultSessionUnlocked()) return false;
  // No PIN yet → must create one (still blocks Home until set)
  return true;
}
