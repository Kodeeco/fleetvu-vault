/**
 * Public Vault gate for Default View (#vault-live / #demo-vault).
 *
 * Bare / → PC multi-portal chooser (not the Vault).
 * Staff escape (secret required) opens Default View unlocked:
 *   https://app.fleetvu.org/vault-open/<YOUR_SECRET>
 * Clear:
 *   https://app.fleetvu.org/vault-locked
 *
 * Never open from a bare path — guessing /vault-open alone must fail.
 */

export const PUBLIC_VAULT_OPEN_KEY = 'fleetvu_public_vault_open';

/**
 * Open flag after staff secret or Fleet unlock CTA (client only).
 * sessionStorage + localStorage — email / in-app browsers often open a new
 * session; localStorage keeps same-device return-to-/ working. Resume links
 * still mint a signed URL for cross-browser mail apps.
 */
export function isPublicVaultOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(PUBLIC_VAULT_OPEN_KEY) === '1') return true;
    if (localStorage.getItem(PUBLIC_VAULT_OPEN_KEY) === '1') {
      sessionStorage.setItem(PUBLIC_VAULT_OPEN_KEY, '1');
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function setPublicVaultOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (open) {
      sessionStorage.setItem(PUBLIC_VAULT_OPEN_KEY, '1');
      localStorage.setItem(PUBLIC_VAULT_OPEN_KEY, '1');
    } else {
      sessionStorage.removeItem(PUBLIC_VAULT_OPEN_KEY);
      localStorage.removeItem(PUBLIC_VAULT_OPEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function isPublicVaultLockedDefaultView(user: {
  companyId?: string | null;
  biometricVerified?: boolean;
  biometricBound?: boolean;
} | null): boolean {
  if (!user || user.companyId !== 'default-view-account') return false;
  return !isPublicVaultOpen();
}

/**
 * Server-only secret. Set FLEETVU_PUBLIC_VAULT_OPEN_KEY on the host (min 12 chars).
 * No hardcoded fallback — missing env fails closed (gate stays locked).
 */
export function getPublicVaultOpenSecret(): string {
  const fromEnv = (process.env.FLEETVU_PUBLIC_VAULT_OPEN_KEY || '').trim();
  if (fromEnv.length >= 12) return fromEnv;
  return '';
}

export function isValidPublicVaultOpenCode(code: string | null | undefined): boolean {
  const got = (code || '').trim();
  if (got.length < 12) return false;
  const expected = getPublicVaultOpenSecret();
  if (got.length !== expected.length) return false;
  // Constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
