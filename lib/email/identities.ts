/**
 * FleetVu Corporate Email Identities
 * Centralized @fleetvu.org mailbox routing for system dispatch.
 */

import type { EmailIdentity } from './types';

export interface CorporateIdentity {
  id: EmailIdentity;
  address: string;
  displayName: string;
  purpose: string;
  defaultReplyTo: string;
}

/**
 * Canonical corporate mailboxes — never hard-code addresses elsewhere.
 */
export const CORPORATE_IDENTITIES: Record<EmailIdentity, CorporateIdentity> = {
  support: {
    id: 'support',
    address: 'support@fleetvu.org',
    displayName: 'FleetVu Support',
    purpose: 'System workspace, licensing, and operational support',
    defaultReplyTo: 'support@fleetvu.org',
  },
  welcome: {
    id: 'welcome',
    address: 'welcome@fleetvu.org',
    displayName: 'FleetVu Onboarding & Dispatch',
    purpose: 'Client and driver onboarding / welcome sequences',
    defaultReplyTo: 'welcome@fleetvu.org',
  },
  safetyreport: {
    id: 'safetyreport',
    address: 'safetyreport@fleetvu.org',
    displayName: 'FleetVu Vault Compliance',
    purpose: 'Incident logging and safety report delivery',
    defaultReplyTo: 'safetyreport@fleetvu.org',
  },
  notice: {
    id: 'notice',
    address: 'notice@fleetvu.org',
    displayName: 'FleetVu Notices',
    purpose: 'Compliance alerts, subscription, and regulatory notices',
    defaultReplyTo: 'support@fleetvu.org',
  },
};

/** Resolve a corporate identity by key. Throws on unknown identity. */
export function resolveIdentity(identity: EmailIdentity): CorporateIdentity {
  const resolved = CORPORATE_IDENTITIES[identity];
  if (!resolved) {
    throw new Error(`Unknown FleetVu email identity: ${identity}`);
  }
  return resolved;
}

/**
 * Map legacy / semantic email types to corporate identities.
 */
export function identityForEmailType(
  type:
    | 'TEAM_INVITE'
    | 'CLIENT_SETUP_LINK'
    | 'DRIVER_FULL_REPORT'
    | 'VAULT_SERVICE_REQUEST'
    | 'SUBSCRIPTION_NOTICE'
    | 'COMPLIANCE_ALERT'
    | 'SYSTEM_SUPPORT'
    | string,
): EmailIdentity {
  switch (type) {
    case 'TEAM_INVITE':
    case 'CLIENT_SETUP_LINK':
      return 'welcome';
    case 'DRIVER_FULL_REPORT':
      return 'safetyreport';
    case 'VAULT_SERVICE_REQUEST':
    case 'SUBSCRIPTION_NOTICE':
    case 'COMPLIANCE_ALERT':
      return 'notice';
    case 'SYSTEM_SUPPORT':
    default:
      return 'support';
  }
}
