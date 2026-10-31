/** Client-safe product line helpers (no Node fs). */

export type ProductLine = 'fleet' | 'insurance' | 'both';

export interface ProductReportItem {
  name: string;
  blurb: string;
  pack: 'fleet' | 'insurance';
  /** Stable generator id — maps to PDF builders shipped in The Vault app */
  generator:
    | 'letter-safety-log-fleet'
    | 'fleet-risk-scorecard'
    | 'letter-safety-log-insurance'
    | 'insurance-scorecard';
}

/**
 * Approved Vault report pack (locked ~2026-10-03 2:48 PM review).
 * Fleet plan → FLEET_REPORTS · Insurance plan → INSURANCE_REPORTS · Fleet-Insurance → all four.
 */
export const FLEET_REPORTS: ProductReportItem[] = [
  {
    name: 'Vault Fleet Safety & Compliance Log',
    blurb:
      'Daily POST Check Summary, Event & Obstruction Log (7 Days), Cryptographic Event Ledger — SHA-256 sealed.',
    pack: 'fleet',
    generator: 'letter-safety-log-fleet',
  },
  {
    name: 'Vault Fleet Risk & Safety Scorecard',
    blurb: 'Fleet-ops safety index — same Vault letter chrome as Insurance Scorecard.',
    pack: 'fleet',
    generator: 'fleet-risk-scorecard',
  },
];

export const INSURANCE_REPORTS: ProductReportItem[] = [
  {
    name: 'Vault Insurance Forensic Compliance Log',
    blurb:
      'Carrier-facing forensic log — Daily POST, Event & Obstruction Log, Cryptographic Event Ledger (SHA-256 Chain).',
    pack: 'insurance',
    generator: 'letter-safety-log-insurance',
  },
  {
    name: 'Vault Insurance Scorecard',
    blurb: 'Actuarial / underwriting scorecard — policy verification and signed audit export.',
    pack: 'insurance',
    generator: 'insurance-scorecard',
  },
];

/** All four approved customer PDFs (Fleet-Insurance / both). */
export const APPROVED_VAULT_REPORT_PACK: ProductReportItem[] = [
  ...FLEET_REPORTS,
  ...INSURANCE_REPORTS,
];

export function normalizeProductLine(value?: string | null): ProductLine {
  if (value === 'insurance') return 'insurance';
  if (value === 'both' || value === 'fleet_insurance' || value === 'fleet+insurance') return 'both';
  return 'fleet';
}

export function productLineLabel(line: ProductLine): string {
  if (line === 'insurance') return 'Insurance';
  if (line === 'both') return 'Fleet-Insurance';
  return 'Fleet';
}

export function reportsForProductLine(line: ProductLine): ProductReportItem[] {
  if (line === 'insurance') return INSURANCE_REPORTS;
  if (line === 'both') return APPROVED_VAULT_REPORT_PACK;
  return FLEET_REPORTS;
}

/** Whether Insurance-pack PDFs should appear for this account. Fleet is the default. */
export function includesInsuranceReports(line: ProductLine): boolean {
  return line === 'insurance' || line === 'both';
}

/** Whether Fleet-pack PDFs should appear for this account. */
export function includesFleetReports(line: ProductLine): boolean {
  return line === 'fleet' || line === 'both';
}
