/**
 * Internal test / demo corporate entity — FleetVu's own Vault account.
 * Use this (not customer brands) for CRM + mobile walkthroughs.
 */

export const THE_VAULT_COMPANY = {
  id: 'company-the-vault',
  name: 'The Vault',
  region: 'West Coast',
  location: 'FleetVu HQ',
  depot: 'FleetVu HQ',
  planTier: 'fleet_insurance' as const,
  industry: 'Fleet safety technology',
  salesRep: 'FleetVu Ops',
  notes: 'Internal test account — use for CRM onboard, reports, and Vault mobile QA',
  /** Default header mark until a custom upload is set */
  logoUrl: '/FV-Vault-logo-gold.png',
} as const;
