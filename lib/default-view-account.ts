/**
 * Default View Account — what bare app.fleetvu.org shows in the Vault
 * (logo + driver profile). Editable from CRM → DEFAULT VIEW ACCOUNT.
 */

import type { AuthUser } from '@/lib/app-context';
import type { CompanyLogoSize } from '@/lib/company-branding';
import { normalizeCompanyLogoSize } from '@/lib/company-branding';

export const DEFAULT_VIEW_ACCOUNT_ID = 'default-view-account';

export interface DefaultViewAccount {
  companyId: string;
  /** Blank allowed — staff fill from CRM anytime */
  companyName: string;
  driverName: string;
  depot: string;
  truckNumber: string;
  driverId: string;
  sensorHardware: string;
  logoUrl: string | null;
  /** Header display: small (icon) or large (wordmark) */
  logoSize: CompanyLogoSize;
  updatedAt: string;
}

export const DEFAULT_VIEW_ACCOUNT_SEED: DefaultViewAccount = {
  companyId: DEFAULT_VIEW_ACCOUNT_ID,
  companyName: '',
  driverName: 'Fuels Pilot Driver',
  depot: 'Fuels Pilot Terminal',
  truckNumber: '#ABF-101',
  driverId: 'F-DRV-01',
  sensorHardware: 'C55-Pro',
  logoUrl: '/FV-Vault-logo-gold.png',
  logoSize: 'large',
  updatedAt: new Date(0).toISOString(),
};

export function isDefaultViewAccountUser(
  user: { companyId?: string | null } | null | undefined,
): boolean {
  return Boolean(user?.companyId === DEFAULT_VIEW_ACCOUNT_ID);
}

/** Build the Vault AuthUser used for bare `/` and #demo-vault Default View. */
export function toDefaultViewAuthUser(account: DefaultViewAccount): AuthUser {
  const depot = (account.depot || '').trim();
  return {
    role: 'driver',
    email: 'default.view@fleetvu.local',
    name: (account.driverName || '').trim() || 'Driver',
    companyName: (account.companyName || '').trim() || undefined,
    companyId: DEFAULT_VIEW_ACCOUNT_ID,
    companyLogoUrl: account.logoUrl || undefined,
    companyLogoSize: normalizeCompanyLogoSize(account.logoSize),
    driverNumber: (account.driverId || '').trim() || undefined,
    driverId: (account.driverId || '').trim() || 'F-DRV-01',
    truckNumber: (account.truckNumber || '').trim() || '#ABF-101',
    sensorHardware: (account.sensorHardware || '').trim() || 'C55-Pro',
    depot: depot || undefined,
    location: depot || undefined,
    planTier: 'proplus',
    // Public vault-live / demo-vault is LOCKED unless /vault-open — app-content applies the gate.
    biometricVerified: false,
    productSku: 'fleetvu',
  };
}
