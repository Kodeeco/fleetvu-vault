/**
 * FleetVu Legal Data Isolation Boundary
 * =====================================
 *
 * HARD RULE (non-negotiable):
 * FleetVu platform operators — including Global Admin — have ZERO access to
 * customer legal, forensic, accident, safety-report, or evidentiary data.
 *
 * Why: FleetVu must not be a party to customer legal discovery or subpoenas
 * related to incidents captured on customer-owned hardware / Vault sessions.
 *
 * PLATFORM ROLE — Global Admin (FleetVu Business Portal):
 *   - Onboard new client companies
 *   - Enter customer commercial / account setup information
 *   - Enable accounts, entitlements, activation keys
 *   - Send welcome / setup emails
 *   - Daily sales, CRM follow-ups, pricing, tenant directory
 *   - System settings for the FleetVu product business
 *   - NOT a viewer of customer accident files or safety reports
 *
 * CUSTOMER PORTAL (Super Admin / Admin / Executive / Driver):
 *   - Full tenant ops including legal/forensic tools they own
 *   - Customer-side AI Support Agent for navigation & product help
 *   - Incident alerts stay inside the customer tenant
 *
 * Who MAY access customer legal/forensic data:
 *   - Customer Super Admin (tenant)
 *   - Customer Location / Company Admin (scoped to their companies)
 *   - Customer Executive (scoped dashboards for their company)
 *   - Customer Drivers (only their own submissions, write path)
 *
 * Who MUST NEVER access customer legal/forensic data:
 *   - global_admin (FleetVu staff)
 *   - Platform operators / support@fleetvu.org tooling
 *   - Any FleetVu internal account
 *
 * Incident alerts MUST route only to the owning customer's Super Admin / Admin
 * accounts — never to FleetVu Global Admin inboxes or dashboards.
 */

import type { UserRole } from '@/lib/types';

/** Data classifications that are customer-exclusive / legally sensitive */
export const CUSTOMER_LEGAL_DATA_CLASSES = [
  'incident_reports',
  'accident_reconstruction',
  'safety_reports',
  'forensic_vault_telemetry',
  'chain_of_custody_evidence',
  'driver_signoffs_evidentiary',
  'insurance_exoneration_packets',
  'legal_export_artifacts',
  'collision_photos_and_documents',
  'witness_statements',
] as const;

export type CustomerLegalDataClass = (typeof CUSTOMER_LEGAL_DATA_CLASSES)[number];

/** Roles that belong to FleetVu platform (not customer tenants) */
export const FLEETVU_PLATFORM_ROLES: readonly UserRole[] = ['global_admin'];

/** Customer roles that may access their own company's legal/forensic data */
export const CUSTOMER_LEGAL_ACCESS_ROLES: readonly string[] = [
  'super_admin',
  'location_admin',
  'admin',
  'executive',
  'auditor', // customer-appointed auditor only — still tenant-scoped
  'driver', // write/own submissions only
];

export interface LegalAccessSubject {
  role: string | null | undefined;
  companyId?: string | null;
  scopedCompanyIds?: string[] | null;
  email?: string | null;
}

/**
 * True when the actor is a FleetVu platform operator (Global Admin / @fleetvu.org).
 * These actors are permanently denied customer legal data.
 */
export function isFleetVuPlatformOperator(subject: LegalAccessSubject): boolean {
  const role = (subject.role || '').toLowerCase();
  if (role === 'global_admin') return true;
  const email = (subject.email || '').toLowerCase();
  if (email.endsWith('@fleetvu.org') || email.endsWith('@fleetvu.com')) return true;
  return false;
}

/**
 * True when the actor may access customer legal/forensic data for a company.
 * Global Admin always returns false.
 */
export function canAccessCustomerLegalData(
  subject: LegalAccessSubject,
  targetCompanyId?: string | null,
): boolean {
  if (isFleetVuPlatformOperator(subject)) return false;

  const role = (subject.role || '').toLowerCase();
  if (!CUSTOMER_LEGAL_ACCESS_ROLES.includes(role) && role !== 'super_admin') {
    // Unknown / platform-like roles denied by default
    if (role === 'global_admin') return false;
  }

  // Drivers: own write-path only — treated as limited access at UI layer
  if (role === 'driver') return true;

  // Customer super_admin / admin / executive — must be scoped to company when provided
  if (targetCompanyId) {
    if (subject.companyId === targetCompanyId) return true;
    if (subject.scopedCompanyIds?.includes(targetCompanyId)) return true;
    // Unscoped customer super_admin of a multi-tenant customer org: allow if role is super_admin
    // and they are NOT a platform operator (already checked)
    if (role === 'super_admin' && subject.companyId) {
      return subject.companyId === targetCompanyId;
    }
    return false;
  }

  // No company context: only customer tenant roles (never global_admin)
  return (
    role === 'super_admin' ||
    role === 'location_admin' ||
    role === 'admin' ||
    role === 'executive' ||
    role === 'auditor'
  );
}

/**
 * UI/feature gate: Global Admin must not see legal/forensic navigation.
 */
export function canSeeLegalForensicUi(subject: LegalAccessSubject): boolean {
  if (isFleetVuPlatformOperator(subject)) return false;
  const role = (subject.role || '').toLowerCase();
  return (
    role === 'super_admin' ||
    role === 'location_admin' ||
    role === 'admin' ||
    role === 'executive' ||
    role === 'auditor'
  );
}

export const LEGAL_ISOLATION_DENIAL_MESSAGE =
  'Access denied. Customer accident files, safety reports, and forensic evidence are exclusively owned by the customer tenant. FleetVu Global Admin has zero access by design (legal isolation / subpoena firewall).';

/**
 * Roles that should receive incident alert notifications for a company.
 * NEVER includes global_admin.
 */
export const INCIDENT_ALERT_RECIPIENT_ROLES = [
  'super_admin',
  'location_admin',
  'admin',
] as const;

export type IncidentAlertRecipientRole = (typeof INCIDENT_ALERT_RECIPIENT_ROLES)[number];
