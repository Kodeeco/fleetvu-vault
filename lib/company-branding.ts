import { isScfuelsTrialUser, SCFUELS_TRIAL } from '@/lib/scfuels-trial';

/** Session fields used to resolve a customer wordmark for dark Vault UI. */
export type BrandableUser = {
  companyLogoUrl?: string | null;
  companyId?: string | null;
  companyName?: string | null;
} | null;

/**
 * Prefer uploaded company logo; fall back to SCFuels trial static asset.
 */
export function resolveCompanyLogoUrl(user: BrandableUser): string | null {
  if (!user) return null;
  if (user.companyLogoUrl) return user.companyLogoUrl;
  if (isScfuelsTrialUser(user)) return SCFUELS_TRIAL.logoWhite;
  return null;
}

export function companyBrandTagline(user: BrandableUser): string | null {
  if (!user) return null;
  if (isScfuelsTrialUser(user)) return SCFUELS_TRIAL.tagline;
  if (user.companyName) return `${user.companyName} · FleetVu Vault`;
  return null;
}
