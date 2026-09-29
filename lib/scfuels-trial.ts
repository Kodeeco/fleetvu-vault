/**
 * SCFuels C55-Pro evaluation trial — FleetVu Mobile profile & channel lock.
 * Matches commercial pilot: Mobile-first, sealed logging, weekly SHA-256 digest.
 */

import type { AuthUser } from '@/lib/app-context';
import { TRIAL_CHANNEL_CONFIG } from '@/lib/edge-filter';

export const SCFUELS_TRIAL = {
  companyName: 'SCFuels',
  companyId: 'trial-scfuels',
  depot: 'SCFuels Pilot Terminal',
  hardware: 'C55-Pro',
  evaluationWindowDays: 30,
  /** Three evaluation units — swap truck #s when install is confirmed */
  trucks: ['#SCF-101', '#SCF-102', '#SCF-103'] as const,
  channels: TRIAL_CHANNEL_CONFIG,
  tagline: 'C55-Pro Evaluation · FleetVu Mobile',
  /** White wordmark for dark Vault UI; black wordmark for light surfaces */
  logoWhite: '/partners/scfuels-logo-white.png',
  logoBlack: '/partners/scfuels-logo-black.png',
} as const;

/** Default driver session for #demo-vault / customer trial walkthrough */
export const SCFUELS_TRIAL_DRIVER: AuthUser = {
  role: 'driver',
  email: 'pilot.driver@scfuels.fleetvu.trial',
  name: 'SCFuels Pilot Driver',
  companyName: SCFUELS_TRIAL.companyName,
  companyId: SCFUELS_TRIAL.companyId,
  driverNumber: 'SCF-DRV-01',
  driverId: 'SCF-DRV-01',
  truckNumber: SCFUELS_TRIAL.trucks[0],
  sensorHardware: SCFUELS_TRIAL.hardware,
  depot: SCFUELS_TRIAL.depot,
  location: SCFUELS_TRIAL.depot,
  planTier: 'proplus',
  biometricVerified: true,
  productSku: 'fleetvu',
};

export function isScfuelsTrialUser(user: { companyId?: string | null; companyName?: string | null } | null): boolean {
  if (!user) return false;
  return user.companyId === SCFUELS_TRIAL.companyId || user.companyName === SCFUELS_TRIAL.companyName;
}
