/**
 * Corporate entity plan packages (not vehicle Basic/Pro/Pro+).
 * Keys are stable; display names & prices live in pricing_config and can change anytime.
 */

import type { ProductLine } from '@/lib/crm/product-line';
import type { PlanTier } from '@/lib/types';

export const CORPORATE_PLAN_IDS = ['fleet', 'insurance', 'fleet_insurance'] as const;
export type CorporatePlanId = (typeof CORPORATE_PLAN_IDS)[number];

export interface CorporatePlanDefaults {
  id: CorporatePlanId;
  /** Stable short code shown in badges / emails */
  code: string;
  /** Editable display name (seed default) */
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  productLine: ProductLine;
}

/** Default catalog — overridden by pricing_config.name / price_monthly when present. */
export const CORPORATE_PLAN_DEFAULTS: CorporatePlanDefaults[] = [
  {
    id: 'fleet',
    code: 'FLEET',
    name: 'Fleet',
    priceMonthly: 9.95,
    description: 'Vault Fleet Safety Report + Fleet Risk & Safety Scorecard.',
    features: [
      'Vault Fleet Safety Report',
      'Vault Fleet Risk & Safety Scorecard',
      'Sensor telemetry & GPS',
      'Driver / shift Safety Log',
    ],
    productLine: 'fleet',
  },
  {
    id: 'insurance',
    code: 'INSURANCE',
    name: 'Insurance',
    priceMonthly: 19.95,
    description: 'Vault Insurance Forensic Compliance Log + Insurance Scorecard.',
    features: [
      'Vault Insurance Forensic Compliance Log',
      'Vault Insurance Scorecard',
      'Carrier / underwriting exports',
      'Chain-of-custody language',
    ],
    productLine: 'insurance',
  },
  {
    id: 'fleet_insurance',
    code: 'FLEET-INSURANCE',
    name: 'Fleet-Insurance',
    priceMonthly: 24.95,
    description: 'Full Fleet pack + full Insurance pack on one corporate entity.',
    features: [
      'All Fleet reports',
      'All Insurance reports',
      'Unified corporate billing',
      'Product flip retained in CRM',
    ],
    productLine: 'both',
  },
];

export function isCorporatePlanId(value: unknown): value is CorporatePlanId {
  return typeof value === 'string' && (CORPORATE_PLAN_IDS as readonly string[]).includes(value);
}

/** Map legacy Basic/Pro/Pro+ (and loose aliases) → corporate plan. */
export function normalizeCorporatePlan(value?: string | null): CorporatePlanId {
  const raw = (value || '').trim().toLowerCase().replace(/[\s/]+/g, '_').replace(/-/g, '_');
  if (raw === 'fleet') return 'fleet';
  if (raw === 'insurance') return 'insurance';
  if (
    raw === 'fleet_insurance' ||
    raw === 'fleetinsurance' ||
    raw === 'both' ||
    raw === 'fleet+insurance'
  ) {
    return 'fleet_insurance';
  }
  // Legacy vehicle-style tiers → best-fit corporate package
  if (raw === 'proplus' || raw === 'pro+') return 'fleet_insurance';
  if (raw === 'pro') return 'fleet';
  if (raw === 'basic') return 'fleet';
  return 'fleet';
}

export function corporatePlanCode(plan: CorporatePlanId): string {
  return CORPORATE_PLAN_DEFAULTS.find((p) => p.id === plan)?.code || plan.toUpperCase();
}

export function corporatePlanToProductLine(plan: CorporatePlanId): ProductLine {
  return CORPORATE_PLAN_DEFAULTS.find((p) => p.id === plan)?.productLine || 'fleet';
}

export function productLineToCorporatePlan(line: ProductLine): CorporatePlanId {
  if (line === 'insurance') return 'insurance';
  if (line === 'both') return 'fleet_insurance';
  return 'fleet';
}

/** Feature gates that still check PlanTier: corporate packages are never “basic”. */
export function planTierForFeatureGate(plan: string | null | undefined): PlanTier {
  const corporate = normalizeCorporatePlan(plan);
  if (corporate === 'fleet') return 'pro';
  return 'proplus';
}

export function formatPlanBadge(plan: string | null | undefined, displayName?: string | null): string {
  if (displayName?.trim()) return displayName.trim();
  const id = normalizeCorporatePlan(plan);
  return corporatePlanCode(id);
}
